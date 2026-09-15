import { describe, expect, it } from "vitest";
import * as schema from "../schema";

describe("schema", () => {
  it("exports a pgTable for every core M0 entity", () => {
    const expected = [
      "orgs",
      "orgMembers",
      "tenantProfiles",
      "properties",
      "units",
      "leases",
      "leaseAmendments",
      "invoices",
      "invoiceLines",
      "payments",
      "paymentAllocations",
      "journalEntries",
      "journalLines",
      "receipts",
      "vendors",
      "maintenanceTickets",
      "maintenanceAttachments",
      "webhookEvents",
      "mpesaCredentials",
      "notificationLog",
      "auditLogs",
      "orgSettings",
    ];

    for (const name of expected) {
      expect(schema, `schema.${name} should be exported`).toHaveProperty(name);
    }
  });
});
