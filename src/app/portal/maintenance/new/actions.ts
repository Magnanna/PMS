"use server";

import { redirect } from "next/navigation";
import crypto from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leases, maintenanceTickets, maintenanceAttachments } from "@/db/schema";
import { requireTenantProfiles } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "maintenance-photos";
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const schema = z.object({
  leaseId: z.string().uuid(),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
});

export type FormState = { error: string | null };

/** US-E1: tenant submits a maintenance request, with up to 5 photos, to a
 *  private storage bucket (signed URLs only — never public). */
export async function createMaintenanceTicket(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { profiles } = await requireTenantProfiles();

  const parsed = schema.safeParse({
    leaseId: formData.get("leaseId"),
    category: formData.get("category"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [lease] = await db.select().from(leases).where(eq(leases.id, parsed.data.leaseId));
  if (!lease) return { error: "Lease not found" };

  const ownsLease = profiles.some((p) => p.id === lease.tenantProfileId);
  if (!ownsLease) return { error: "Not your lease" };

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PHOTOS) {
    return { error: `Maximum ${MAX_PHOTOS} photos` };
  }
  for (const photo of photos) {
    if (photo.size > MAX_PHOTO_BYTES) return { error: "Each photo must be under 10MB" };
    if (!photo.type.startsWith("image/")) return { error: "Only image files are supported" };
  }

  const [ticket] = await db
    .insert(maintenanceTickets)
    .values({
      orgId: lease.orgId,
      unitId: lease.unitId,
      leaseId: lease.id,
      category: parsed.data.category,
      description: parsed.data.description,
      status: "open",
    })
    .returning({ id: maintenanceTickets.id });

  if (photos.length > 0) {
    const admin = createAdminClient();
    await admin.storage.createBucket(BUCKET, { public: false }).catch((e) => {
      if (!/already exists/i.test(e?.message ?? "")) throw e;
    });

    for (const photo of photos) {
      const ext = photo.type.split("/")[1]?.split("+")[0] || "jpg";
      const path = `${lease.orgId}/${ticket.id}/${crypto.randomUUID()}.${ext}`;
      const bytes = Buffer.from(await photo.arrayBuffer());
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: photo.type, upsert: false });
      if (uploadError) continue; // ticket is still created even if a photo fails

      await db.insert(maintenanceAttachments).values({ ticketId: ticket.id, storagePath: path });
    }
  }

  redirect("/portal/maintenance");
}
