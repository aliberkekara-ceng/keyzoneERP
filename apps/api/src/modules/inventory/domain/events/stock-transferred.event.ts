import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';
import { QuantityPayload } from './stock-received.event.js';

/**
 * StockTransferred Domain Event
 *
 * Depolar arası transfer (TRANSFER_OUT + TRANSFER_IN) başarıyla tamamlandığında tetiklenir.
 * Lojistik ve şubeler arası mutabakat için kullanılır.
 */
export class StockTransferred implements IDomainEvent {
  public readonly eventName = 'StockTransferred';
  public readonly eventVersion = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // transferReferenceId
    public readonly tenantId: string,
    public readonly fromWarehouseId: string,
    public readonly toWarehouseId: string,
    public readonly productId: string,
    public readonly quantity: QuantityPayload,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}

