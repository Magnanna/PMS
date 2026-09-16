import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { mpesaCredentials, payments, webhookEvents, invoices } from "@/db/schema";
import { parseMpesaCallback, isInboundFailure } from "@/lib/payments/mpesaDaraja";
import { confirmPayment } from "@/lib/payments/confirm";

/**
 * US-C2/US-C9: single endpoint for both Daraja STK callbacks and C2B
 * confirmations (Safaricom posts both here — they're told apart by shape,
 * see parseMpesaCallback). Idempotent via the webhook_events unique
 * (source, external_id) index: a replayed callback is a guaranteed no-op,
 * never a double-post.
 *
 * Daraja has no request signature, so the per-org random `token` query
 * param (US-C10) is what proves this call is really from that org's own
 * Daraja app rather than a guessed orgId.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId");
  const token = url.searchParams.get("token");

  if (!orgId || !token) {
    return NextResponse.json({ error: "Missing orgId/token" }, { status: 400 });
  }

  const [creds] = await db
    .select({ webhookToken: mpesaCredentials.webhookToken })
    .from(mpesaCredentials)
    .where(eq(mpesaCredentials.orgId, orgId));

  if (!creds || creds.webhookToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = parseMpesaCallback(body);

  if (!result) {
    // Unrecognized payload shape — still ack 200 so Daraja doesn't retry
    // forever, but nothing to process.
    return NextResponse.json({ received: true });
  }

  const externalId = isInboundFailure(result) ? result.requestRef : result.providerRef;
  const source = "mpesa";

  const inserted = await db
    .insert(webhookEvents)
    .values({ orgId, source, externalId, rawPayload: body as object, processed: false })
    .onConflictDoNothing({ target: [webhookEvents.source, webhookEvents.externalId] })
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    // Already seen this exact callback — idempotent no-op (US-C9).
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (isInboundFailure(result)) {
    await db
      .update(payments)
      .set({ status: "failed" })
      .where(and(eq(payments.orgId, orgId), eq(payments.providerRequestRef, result.requestRef)));

    await db
      .update(webhookEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(webhookEvents.id, inserted[0].id));

    return NextResponse.json({ received: true });
  }

  // STK success: find the pending payment by CheckoutRequestID.
  if (result.requestRef) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(eq(payments.orgId, orgId), eq(payments.providerRequestRef, result.requestRef))
      );

    if (payment) {
      if (payment.amountCents !== result.amountCents) {
        // AC: amount mismatch -> held for review, never auto-posted.
        await db
          .update(payments)
          .set({ status: "held_for_review", mpesaReceiptNumber: result.providerRef })
          .where(eq(payments.id, payment.id));
      } else {
        await db
          .update(payments)
          .set({ mpesaReceiptNumber: result.providerRef })
          .where(eq(payments.id, payment.id));
        await confirmPayment(payment.id);
      }

      await db
        .update(webhookEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(webhookEvents.id, inserted[0].id));

      return NextResponse.json({ received: true });
    }
  }

  // C2B confirmation (no pre-existing payment row) — match by exact
  // account reference against an open invoice in this org. This is the
  // narrow slice of US-C3 needed to not lose money landing this way; the
  // full "needs review" queue UI for unmatched payments is the rest of
  // that story, not yet built. Unmatched events stay in webhook_events
  // (processed=false) rather than being silently dropped.
  if (result.accountRef) {
    const [matchedInvoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.reference, result.accountRef.trim())));

    if (matchedInvoice) {
      const [payment] = await db
        .insert(payments)
        .values({
          orgId,
          leaseId: matchedInvoice.leaseId,
          method: "mpesa_c2b",
          status: "pending",
          amountCents: result.amountCents,
          mpesaReceiptNumber: result.providerRef,
        })
        .returning({ id: payments.id });

      await confirmPayment(payment.id);

      await db
        .update(webhookEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(webhookEvents.id, inserted[0].id));

      return NextResponse.json({ received: true });
    }
  }

  // Unmatched — leave webhook_events.processed = false for manual review.
  return NextResponse.json({ received: true, matched: false });
}
