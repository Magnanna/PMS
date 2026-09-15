# Permission matrix (US-A6)

Three roles: `owner`, `manager`, `tenant`. Enforced server-side in
`src/lib/auth/permissions.ts` (checked in every server action / route
handler before a mutation) **and** hidden in the UI. RLS (`drizzle/0001_rls_policies.sql`)
is the last line of defense, not the only one — a bug in a server action
must not be the only thing standing between a manager and org deletion.

| Action | owner | manager | tenant |
|---|---|---|---|
| View org settings | yes | yes | no |
| Edit org settings (late fee, reminders) | yes | yes | no |
| Connect/edit M-Pesa (Daraja) credentials | yes | no | no |
| Delete org | yes | no | no |
| Transfer ownership | yes | no | no |
| Invite/remove staff (manager) | yes | no | no |
| Property/unit CRUD | yes | yes | no |
| Lease create/renew/terminate | yes | yes | no |
| Invite tenant | yes | yes | no |
| Record manual (cash/bank) payment | yes | yes | no |
| Void an invoice | yes | yes | no |
| View reports (dashboard, P&L, aging) | yes | yes | no (own statement only) |
| Assign/close maintenance ticket | yes | yes | no (can open + view own only) |
| View own lease/balance/receipts | n/a | n/a | yes |
| Pay rent | n/a | n/a | yes |
| Submit maintenance request | n/a | n/a | yes |

Notes:
- A `tenant` is never an `org_member` row — they're a `tenant_profiles` row
  linked by `user_id`. See US-A5 for the cross-org identity model.
- This table grows as new stories land (e.g. US-J3 platform admin adds a
  fourth, separate-realm role). Keep it in sync with `permissions.ts`.
