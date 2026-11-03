import { DomainError } from './domain-error.base.js';

export class InvalidReferenceError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

