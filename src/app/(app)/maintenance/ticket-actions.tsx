"use client";

import { useActionState, useState, useTransition } from "react";
import { updateTicketStatus, assignVendor, closeTicketWithCost } from "./actions";

const NEXT_STATUS: Record<string, string | null> = {
  open: "assigned",
  assigned: "in_progress",
  in_progress: "resolved",
  resolved: "closed",
  closed: null,
};

export function TicketActions({ ticketId, status }: { ticketId: string; status: string }) {
  const [mode, setMode] = useState<"none" | "assign" | "close">("none");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const boundAssign = assignVendor.bind(null, ticketId);
  const boundClose = closeTicketWithCost.bind(null, ticketId);
  const [assignState, assignAction] = useActionState(boundAssign, { error: null });
  const [closeState, closeAction] = useActionState(boundClose, { error: null });

  if (mode === "assign") {
    return (
      <form action={assignAction} className="text-left space-y-1.5 max-w-[200px] ml-auto">
        {assignState.error && (
          <p className="text-[10.5px] text-[var(--color-bad)]">{assignState.error}</p>
        )}
        <input
          name="vendorName"
          placeholder="Vendor name"
          required
          className="hairline w-full rounded-md px-2 py-1 text-[11.5px]"
        />
        <input
          name="vendorPhone"
          placeholder="Phone (optional)"
          className="hairline w-full rounded-md px-2 py-1 text-[11.5px]"
        />
        <div className="flex gap-1.5">
          <button type="submit" className="btn-primary px-2 py-1 text-[11.5px] flex-1">
            Assign
          </button>
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-[11.5px]"
            onClick={() => setMode("none")}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (mode === "close") {
    return (
      <form action={closeAction} className="text-left space-y-1.5 max-w-[200px] ml-auto">
        {closeState.error && (
          <p className="text-[10.5px] text-[var(--color-bad)]">{closeState.error}</p>
        )}
        <input
          name="costKes"
          type="number"
          min={0}
          step="0.01"
          placeholder="Cost (KES, optional)"
          className="hairline w-full rounded-md px-2 py-1 text-[11.5px]"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-ink-600)]">
          <input type="checkbox" name="billableToTenant" />
          Bill to tenant
        </label>
        <div className="flex gap-1.5">
          <button type="submit" className="btn-primary px-2 py-1 text-[11.5px] flex-1">
            Close
          </button>
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-[11.5px]"
            onClick={() => setMode("none")}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const next = NEXT_STATUS[status];

  return (
    <div className="flex items-center justify-end gap-1.5">
      {error && <p className="text-[10.5px] text-[var(--color-bad)]">{error}</p>}
      {status === "open" && (
        <button
          type="button"
          className="btn-secondary px-2.5 py-1 text-[11.5px]"
          onClick={() => setMode("assign")}
        >
          Assign
        </button>
      )}
      {next && next !== "closed" && status !== "open" && (
        <button
          type="button"
          disabled={pending}
          className="btn-secondary px-2.5 py-1 text-[11.5px]"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await updateTicketStatus(ticketId, next as never);
              if (r.error) setError(r.error);
            });
          }}
        >
          Mark {next.replace("_", " ")}
        </button>
      )}
      {status === "resolved" && (
        <button
          type="button"
          className="btn-primary px-2.5 py-1 text-[11.5px]"
          onClick={() => setMode("close")}
        >
          Close ticket
        </button>
      )}
    </div>
  );
}
