import { DomainError } from './domain-error.base.js';

export class InvalidArgumentError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

