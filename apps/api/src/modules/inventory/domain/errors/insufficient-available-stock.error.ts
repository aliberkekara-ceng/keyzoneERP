import { DomainError } from './domain-error.base.js';

export class InsufficientAvailableStockError extends DomainError {
  constructor(warehouseId: string, productId: string, requested: string, available: string) {
    super(
      `Insufficient available stock in warehouse '${warehouseId}' for product '${productId}'. Requested: ${requested}, Available (OnHand - Reserved): ${available}.`,
    );
  }
}

