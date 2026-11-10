import { DomainError } from './domain-error.base.js';

/**
 * InsufficientPermissionError
 *
 * Kullanıcının talep edilen işlemi gerçekleştirmek için gerekli izne (permission)
 * sahip olmadığı durumlarda fırlatılır.
 */
export class InsufficientPermissionError extends DomainError {
  constructor(requiredPermission: string) {
    super(`Insufficient permission. Required permission: '${requiredPermission}'.`);
  }
}

