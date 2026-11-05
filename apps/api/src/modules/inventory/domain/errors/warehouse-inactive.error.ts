import { DomainError } from './domain-error.base.js';

export class WarehouseInactiveError extends DomainError {
  constructor(warehouseId: string) {
    super(
      `Warehouse '${warehouseId}' is inactive. Operations cannot be performed on an inactive warehouse.`,
    );
  }
}

