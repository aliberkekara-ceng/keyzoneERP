import type { PrismaClient } from '@prisma/client';
import { Reservation } from '../../domain/entities/reservation.entity.js';
import { OptimisticLockError } from '../../domain/errors/index.js';
import { ReservationRepositoryPort } from '../../application/ports/reservation.repository.port.js';
import { ReservationMapper } from './reservation.mapper.js';
import {
  PrismaTransactionContext,
  type PrismaTransactionClient,
} from './prisma-transaction-context.js';

/**
 * PrismaReservationRepository
 *
 * `ReservationRepositoryPort` sözleşmesinin Prisma/PostgreSQL implementasyonudur.
 * Rezervasyon durum geçişlerinde (`ACTIVE -> RELEASED | CONSUMED`) `version`
 * üzerinden Optimistic Concurrency Control uygular.
 */
export class PrismaReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  private get client(): PrismaClient | PrismaTransactionClient {
    return PrismaTransactionContext.getClient(this.prisma);
  }

  public async findById(
    tenantId: string,
    reservationId: string,
  ): Promise<Reservation | null> {
    const record = await this.client.reservationRecord.findFirst({
      where: {
        id: reservationId,
        tenantId,
      },
    });

    if (!record) {
      return null;
    }

    return ReservationMapper.toDomain(record);
  }

  public async save(reservation: Reservation): Promise<void> {
    const data = ReservationMapper.toPersistence(reservation);
    const client = this.client;

    const existing = await client.reservationRecord.findUnique({
      where: { id: data.id },
      select: { id: true },
    });

    if (!existing) {
      await client.reservationRecord.create({
        data: {
          ...data,
          version: 1,
        },
      });
      return;
    }

    const updated = await client.reservationRecord.updateMany({
      where: {
        id: data.id,
        tenantId: data.tenantId,
        version: data.version,
      },
      data: {
        status: data.status,
        consumedMovementId: data.consumedMovementId,
        version: data.version + 1,
        updatedAt: data.updatedAt,
      },
    });

    if (updated.count === 0) {
      throw new OptimisticLockError('Reservation', data.id, data.version);
    }
  }
}

