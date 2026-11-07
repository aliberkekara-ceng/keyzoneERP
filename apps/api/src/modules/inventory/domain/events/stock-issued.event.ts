import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';
import { QuantityPayload, MovementReferencePayload } from './stock-received.event.js';

/**
 * StockIssued Domain Event
 *
 * Depodan stok çıkışı (ISSUE) yapıldığında tetiklenir.
 * Satış irsaliyesi, sevkiyat veya üretim tüketimi süreçlerine bildirim sağlar.
 */
export class StockIssued implements IDomainEvent {
  public readonly eventName = 'StockIssued';
  public readonly eventVersion = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // movementId
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly productId: string,
    public readonly quantity: QuantityPayload,
    public readonly reference?: MovementReferencePayload | null,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}

