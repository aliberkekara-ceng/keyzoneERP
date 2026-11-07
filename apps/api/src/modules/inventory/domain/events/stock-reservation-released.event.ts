import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';
import { QuantityPayload } from './stock-received.event.js';

/**
 * StockReservationReleased Domain Event
 *
 * İptal edilen sipariş veya zaman aşımı sebebiyle rezerve stok serbest bırakıldığında tetiklenir.
 * Kullanılabilir (available) stoku yeniden artırır.
 */
export class StockReservationReleased implements IDomainEvent {
  public readonly eventName = 'StockReservationReleased';
  public readonly eventVersion = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // reservationId
    public readonly tenantId: string,
    public readonly warehouseId: string,
    public readonly productId: string,
    public readonly quantity: QuantityPayload,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}

