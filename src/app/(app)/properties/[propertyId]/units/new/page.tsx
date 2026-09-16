import { notFound } from "next/navigation";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireOrgMembership } from "@/lib/auth/session";
import { NewUnitForm } from "./form";

export default async function NewUnitPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { orgId } = await requireOrgMembership();

  const [property] = await db
    .select({ type: properties.type, name: properties.name })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.orgId, orgId)));

  if (!property) notFound();

  return (
    <div className="flex justify-center">
      <NewUnitForm propertyId={propertyId} propertyType={property.type} />
    </div>
  );
}
