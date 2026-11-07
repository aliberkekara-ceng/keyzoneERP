import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';

export interface QuantityPayload {
  readonly amount: string;
  readonly unit: string;
}

export interface MovementReferencePayload {
  readonly type: string;
  readonly id: string;
}

/**
 * StockReceived Domain Event
 *
 * Depoya yeni stok girişi (RECEIPT) tamamlandığında tetiklenir.
 * Satın alma faturası veya irsaliye mutabakatı için diğer modüllere sinyal üretir.
 */
export class StockReceived implements IDomainEvent {
  public readonly eventName = 'StockReceived';
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

