import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';

/**
 * UnitOfWorkPort
 *
 * Çoklu repository işlemlerini ve aggregate'lerden toplanan domain event'leri
 * tek bir atomik veritabanı transaction'ı içinde yürütür.
 */
export interface UnitOfWorkPort {
  execute<T>(work: () => Promise<T>): Promise<T>;
  collectEvents(events: IDomainEvent[]): void;
}
