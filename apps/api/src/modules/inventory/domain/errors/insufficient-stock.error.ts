import { DomainError } from './domain-error.base.js';

export class InsufficientStockError extends DomainError {
  constructor(warehouseId: string, productId: string, requested: string, onHand: string) {
    super(
      `Insufficient stock in warehouse '${warehouseId}' for product '${productId}'. Requested: ${requested}, On-hand: ${onHand}.`,
    );
  }
}

