import { IDomainEvent } from './domain-event.js';

/**
 * Base Aggregate Root (Shared Kernel)
 *
 * Aggregate Root'lar kendi transaction ve invariant sınırlarını korur.
 * Davranış metotları çalıştıkça oluşan domain event'leri bünyesinde toplar.
 * Unit of Work commit aşamasında bu event'ler `pullDomainEvents()` ile çekilip outbox'a yazılır.
 */
export abstract class AggregateRoot<TId = string> {
  protected readonly _id: TId;
  private _domainEvents: IDomainEvent[] = [];

  constructor(id: TId) {
    this._id = id;
  }

  public get id(): TId {
    return this._id;
  }

  protected addDomainEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Biriken domain event'leri döndürür ve aggregate'in iç kuyruğunu sıfırlar.
   */
  public pullDomainEvents(): IDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }
}

