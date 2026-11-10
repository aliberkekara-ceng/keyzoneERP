import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';
import { UnitOfWorkPort } from '../ports/unit-of-work.port.js';

/**
 * SyncUnitOfWork
 *
 * Testlerde transaction altyapısını ve outbox event toplamasını simüle eden
 * basit bir UnitOfWork adaptörü.
 */
export class SyncUnitOfWork implements UnitOfWorkPort {
  private readonly _collectedEvents: IDomainEvent[] = [];

  public async execute<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }

  public collectEvents(events: IDomainEvent[]): void {
    this._collectedEvents.push(...events);
  }

  public getCollectedEvents(): IDomainEvent[] {
    return [...this._collectedEvents];
  }

  public clearEvents(): void {
    this._collectedEvents.length = 0;
  }
}
