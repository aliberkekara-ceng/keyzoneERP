import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';
import { QuantityPayload } from './stock-received.event.js';

/**
 * StockAdjusted Domain Event
 *
 * Depoda fiziksel sayım düzeltmesi veya hasar/fire çıkışı (ADJUSTMENT_IN / ADJUSTMENT_OUT) yapıldığında tetiklenir.
 * Muhasebe modülünde sayım farkı yevmiye kaydı (679/689 hesaplar) oluşturulması için dinlenir.
 */
export class StockAdjusted implements IDomainEvent {
  public readonly eventName = 'StockAdjusted';
  public readonly eventVersion = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // movementId
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly productId: string,
    public readonly direction: 'IN' | 'OUT',
    public readonly quantity: QuantityPayload,
    public readonly reason?: string | null,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}

