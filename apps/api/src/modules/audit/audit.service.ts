import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import type { RequestContext } from '../../common/utilities/request-context';

export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  tenantId?: string | null;
  businessId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  context?: RequestContext;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
  ) {}

  /** Audit failures must never break the business operation being audited. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditLogs.insert({
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        tenantId: entry.tenantId ?? null,
        businessId: entry.businessId ?? null,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? null) as never,
        ipAddress: entry.context?.ipAddress ?? null,
        userAgent: entry.context?.userAgent ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write audit log for action ${entry.action}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async listForBusiness(businessId: string, limit = 100): Promise<AuditLog[]> {
    return this.auditLogs.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
