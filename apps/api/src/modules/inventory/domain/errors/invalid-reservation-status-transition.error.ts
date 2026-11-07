import { DomainError } from './domain-error.base.js';

export class InvalidReservationStatusTransitionError extends DomainError {
  constructor(reservationId: string, currentStatus: string, targetStatus: string) {
    super(
      `Cannot transition reservation '${reservationId}' from '${currentStatus}' to '${targetStatus}'.`,
    );
  }
}

