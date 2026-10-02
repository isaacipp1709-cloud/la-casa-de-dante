import type { AuditEvent } from "@/contracts/audit";

export interface AuditLogPort {
  record(event: AuditEvent): void;
}
