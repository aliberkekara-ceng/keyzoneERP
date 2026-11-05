/**
 * Domain Event Interface (Shared Kernel)
 *
 * Domain katmanında gerçekleşen iş olaylarını temsil eder.
 * Saf TypeScript nesnesidir; harici kütüphane bağımlılığı taşımaz.
 */
export interface IDomainEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
}

