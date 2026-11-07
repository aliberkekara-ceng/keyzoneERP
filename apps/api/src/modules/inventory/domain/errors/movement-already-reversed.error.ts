import { DomainError } from './domain-error.base.js';

export class MovementAlreadyReversedError extends DomainError {
  constructor(movementId: string) {
    super(`Stock movement '${movementId}' has already been reversed and cannot be reversed again.`);
  }
}

