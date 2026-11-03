import { DomainError } from './domain-error.base.js';

export class InvalidWarehouseCodeError extends DomainError {
  constructor(code: string) {
    super(
      `Invalid warehouse code '${code}'. Code must be 2-20 characters long and contain only uppercase letters, digits, and hyphens.`,
    );
  }
}

