import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';
import { QuantityPayload, MovementReferencePayload } from './stock-received.event.js';

/**
 * StockReserved Domain Event
 *
 * Müşteri siparişi veya dahili talep için stok rezerve edildiğinde tetiklenir.
 * Rezervasyon, fiziksel on-hand miktarını değiştirmez; kullanılabilir (available) stoku düşürür.
 */
export class StockReserved implements IDomainEvent {
  public readonly eventName = 'StockReserved';
  public readonly eventVersion = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // reservationId
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly productId: string,
    public readonly quantity: QuantityPayload,
    public readonly reference: MovementReferencePayload,
    public readonly expiresAt?: Date | null,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}

