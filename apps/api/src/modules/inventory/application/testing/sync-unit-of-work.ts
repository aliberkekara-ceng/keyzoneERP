import { UnitOfWorkPort } from '../ports/unit-of-work.port.js';

/**
 * SyncUnitOfWork
 *
 * Testlerde transaction altyapısını simüle eden basit bir UnitOfWork adaptörü.
 * Gelen callback'i doğrudan çalıştırır.
 */
export class SyncUnitOfWork implements UnitOfWorkPort {
  public async execute<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

