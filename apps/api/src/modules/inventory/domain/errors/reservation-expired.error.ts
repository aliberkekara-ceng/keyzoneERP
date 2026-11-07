import { DomainError } from './domain-error.base.js';

export class ReservationExpiredError extends DomainError {
  constructor(reservationId: string, expiresAt: Date) {
    super(
      `Reservation '${reservationId}' expired at '${expiresAt.toISOString()}' and cannot be consumed.`,
    );
  }
}

