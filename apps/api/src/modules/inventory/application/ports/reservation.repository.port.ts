import { Reservation } from '../../domain/entities/reservation.entity.js';

/**
 * ReservationRepositoryPort
 *
 * Reservation Aggregate Root için kalıcılık (persistence) sözleşmesidir.
 * Her Aggregate Root kendi bağımsız repository portuna sahiptir.
 */
export interface ReservationRepositoryPort {
  findById(
    tenantId: string,
    reservationId: string,
  ): Promise<Reservation | null>;

  save(reservation: Reservation): Promise<void>;
}

