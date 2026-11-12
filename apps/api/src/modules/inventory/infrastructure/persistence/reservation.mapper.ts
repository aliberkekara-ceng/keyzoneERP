import { Prisma, type ReservationRecord } from '@prisma/client';
import { Reservation } from '../../domain/entities/reservation.entity.js';
import { ReservationStatus } from '../../domain/entities/reservation-status.enum.js';
import { Quantity } from '../../domain/value-objects/quantity.vo.js';
import { MovementReference } from '../../domain/value-objects/movement-reference.vo.js';

export interface ReservationPersistenceData {
  id: string;
  tenantId: string;
  warehouseId: string;
  productId: string;
  quantity: Prisma.Decimal;
  unitCode: string;
  referenceType: string;
  referenceId: string;
  status: string;
  consumedMovementId: string | null;
  expiresAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ReservationMapper
 *
 * Domain `Reservation` aggregate root'u ile Prisma `ReservationRecord`
 * arasındaki çift yönlü dönüşümü gerçekleştirir.
 */
export class ReservationMapper {
  public static toDomain(record: ReservationRecord): Reservation {
    const quantityResult = Quantity.of(
      record.quantity.toString(),
      record.unitCode,
    );
    if (quantityResult.isFailure) {
      throw quantityResult.error;
    }

    const referenceResult = MovementReference.of(
      record.referenceType,
      record.referenceId,
    );
    if (referenceResult.isFailure) {
      throw referenceResult.error;
    }

    return Reservation.reconstitute({
      id: record.id,
      tenantId: record.tenantId,
      warehouseId: record.warehouseId,
      productId: record.productId,
      quantity: quantityResult.value,
      reference: referenceResult.value,
      status: record.status as ReservationStatus,
      expiresAt: record.expiresAt,
      consumedMovementId: record.consumedMovementId,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  public static toPersistence(
    reservation: Reservation,
  ): ReservationPersistenceData {
    return {
      id: reservation.id,
      tenantId: reservation.tenantId,
      warehouseId: reservation.warehouseId,
      productId: reservation.productId,
      quantity: new Prisma.Decimal(reservation.quantity.amount.toString()),
      unitCode: reservation.quantity.unit,
      referenceType: reservation.reference.type,
      referenceId: reservation.reference.id,
      status: reservation.status,
      consumedMovementId: reservation.consumedMovementId,
      expiresAt: reservation.expiresAt,
      version: reservation.version,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };
  }
}

