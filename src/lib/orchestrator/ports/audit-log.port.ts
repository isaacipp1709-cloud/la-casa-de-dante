import { AuditEvent, AuditEventSchema } from "@/contracts/audit";
import type { DanteLogEntry } from "@/lib/dante-bridge/types";

export interface AuditLogPort {
  record(event: AuditEvent): void;
  getRecentLogs(): DanteLogEntry[];
}

export class InMemoryAuditLogAdapter implements AuditLogPort {
  private entries: DanteLogEntry[] = [];
  private maxEntries = 50;

  record(event: AuditEvent): void {
    const parsed = AuditEventSchema.safeParse(event);
    if (!parsed.success) return;

    const valid = parsed.data;
    const entry: DanteLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: valid.timestamp || new Date().toISOString(),
      level: valid.status === "error" ? "error" : "info",
      module: `audit:${valid.provider}`,
      message: `[${valid.correlationId}] Transacción ${valid.status.toUpperCase()} vía ${valid.provider} en ${valid.durationMs}ms${valid.route ? ` (${valid.route})` : ""}`,
    };

    this.entries = [entry, ...this.entries].slice(0, this.maxEntries);
  }

  getRecentLogs(): DanteLogEntry[] {
    return this.entries;
  }
}
