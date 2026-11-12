import { DomainError } from './domain-error.base.js';

/**
 * OptimisticLockError
 *
 * Aynı kaydın paralel bir işlem (transaction) tarafından güncellendiği ve
 * bellekteki `version` numarasının veritabanındaki güncel `version` ile
 * uyuşmadığı durumda fırlatılır (Optimistic Concurrency Control).
 */
export class OptimisticLockError extends DomainError {
  public readonly code = 'OPTIMISTIC_LOCK_CONFLICT';

  constructor(
    public readonly entityName: string,
    public readonly identifier: string,
    public readonly expectedVersion: number,
  ) {
    super(
      `Concurrency conflict on ${entityName} (${identifier}): expected version ${expectedVersion}, but the record was modified by another transaction.`,
    );
  }
}

