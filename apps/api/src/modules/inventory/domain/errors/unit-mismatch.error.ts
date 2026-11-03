import { DomainError } from './domain-error.base.js';

export class UnitMismatchError extends DomainError {
  constructor(unitA: string, unitB: string) {
    super(`Unit mismatch: Cannot calculate between '${unitA}' and '${unitB}'.`);
  }
}

