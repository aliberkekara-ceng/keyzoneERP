import { DomainError } from './domain-error.base.js';

export class WarehouseAlreadyActiveError extends DomainError {
  constructor(warehouseId: string) {
    super(`Warehouse '${warehouseId}' is already active.`);
  }
}

export class WarehouseAlreadyInactiveError extends DomainError {
  constructor(warehouseId: string) {
    super(`Warehouse '${warehouseId}' is already inactive.`);
  }
}

