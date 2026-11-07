import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';

/**
 * WarehouseCreated Domain Event
 *
 * Bir depo başarıyla oluşturulduğunda fırlatılır.
 * Diğer modüllerin (Muhasebe, Satış vb.) depoyu tanıması için kullanılır.
 */
export class WarehouseCreated implements IDomainEvent {
  public readonly eventName = 'WarehouseCreated';
  public readonly eventVersion = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // warehouseId
    public readonly tenantId: string,
    public readonly code: string,
    public readonly name: string,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}