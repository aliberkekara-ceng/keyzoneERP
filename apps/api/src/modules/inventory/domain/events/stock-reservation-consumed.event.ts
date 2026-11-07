import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';
import { QuantityPayload } from './stock-received.event.js';

/**
 * StockReservationConsumed Domain Event
 *
 * Rezerve edilen stok fiilen depodan sevk edildiğinde (ISSUE) tetiklenir.
 * Rezervasyon kaydı tüketilir (CONSUMED) ve rezerve miktar düşerken fiili stok da eş zamanlı düşer.
 */
export class StockReservationConsumed implements IDomainEvent {
  public readonly eventName = 'StockReservationConsumed';
  public readonly eventVersion = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // reservationId
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly productId: string,
    public readonly quantity: QuantityPayload,
    public readonly movementId: string,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}

