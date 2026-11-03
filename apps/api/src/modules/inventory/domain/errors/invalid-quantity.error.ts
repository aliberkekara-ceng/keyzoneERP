import { DomainError } from './domain-error.base.js';

export class InvalidQuantityError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

