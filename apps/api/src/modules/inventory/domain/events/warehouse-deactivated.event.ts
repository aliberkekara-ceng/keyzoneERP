import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';

/**
 * WarehouseDeactivated Domain Event
 *
 * Bir depo pasif duruma getirildiğinde fırlatılır.
 * Satış ve lojistik modüllerinin bu depoya yeni sevkiyat planlamasını durdurur.
 */
export class WarehouseDeactivated implements IDomainEvent {
  public readonly eventName = 'WarehouseDeactivated';
  public readonly eventVersion = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // warehouseId
    public readonly tenantId: string,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}