import { DomainError } from './domain-error.base.js';

export class StockBalanceMismatchError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

