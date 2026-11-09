import { DomainError } from './domain-error.base.js';

/**
 * WarehouseCodeAlreadyExistsError
 *
 * Bir kiracı içinde aynı depo koduyla ikinci bir depo açılmak istendiğinde fırlatılır.
 */
export class WarehouseCodeAlreadyExistsError extends DomainError {
  constructor(tenantId: string, code: string) {
    super(`Warehouse with code '${code}' already exists in tenant '${tenantId}'.`);
  }
}

