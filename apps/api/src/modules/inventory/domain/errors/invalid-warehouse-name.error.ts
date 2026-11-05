import { DomainError } from './domain-error.base.js';

export class InvalidWarehouseNameError extends DomainError {
  constructor(message: string = 'Warehouse name cannot be empty.') {
    super(message);
  }
}

