import type { PrismaClient } from '@prisma/client';
import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';
import { UnitOfWorkPort } from '../../application/ports/unit-of-work.port.js';
import { CurrentTenantPort } from '../../application/ports/current-tenant.port.js';
import { PrismaTransactionContext } from './prisma-transaction-context.js';

/**
 * PrismaUnitOfWork
 *
 * Birden fazla repository işlemini tek bir atomik PostgreSQL transaction'ı
 * içinde yürütür. Transaction başında `app.current_tenant_id` oturum değişkenini
 * parametreli `set_config(..., true)` ile ayarlayarak PostgreSQL RLS politikalarını
 * aktif hale getirir.
 */
export class PrismaUnitOfWork implements UnitOfWorkPort {
  private readonly collectedEvents: IDomainEvent[] = [];

  constructor(
    private readonly prisma: PrismaClient,
    private readonly currentTenant?: CurrentTenantPort,
  ) {}

  public async execute<T>(work: () => Promise<T>): Promise<T> {
    // Halihazırda aktif bir transaction varsa yeniden sarmalama (nested tx önleme)
    const existingTx = PrismaTransactionContext.getStore();
    if (existingTx) {
      return work();
    }

    return this.prisma.$transaction(async (tx) => {
      const tenantId = this.currentTenant?.getTenantId();
      if (tenantId) {
        // RLS savunma hattı: is_local = true ile yalnızca bu transaction süresince geçerlidir
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      }

      return PrismaTransactionContext.run(tx, work);
    });
  }

  public collectEvents(events: IDomainEvent[]): void {
    this.collectedEvents.push(...events);
  }

  public pullCollectedEvents(): IDomainEvent[] {
    const events = [...this.collectedEvents];
    this.collectedEvents.length = 0;
    return events;
  }
}

