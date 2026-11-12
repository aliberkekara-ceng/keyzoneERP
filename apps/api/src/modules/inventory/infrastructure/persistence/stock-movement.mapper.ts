import { Prisma, type StockMovementRecord } from '@prisma/client';
import { StockMovement } from '../../domain/entities/stock-movement.entity.js';
import { StockMovementType } from '../../domain/entities/stock-movement-type.enum.js';
import { Quantity } from '../../domain/value-objects/quantity.vo.js';
import { MovementReference } from '../../domain/value-objects/movement-reference.vo.js';

export interface StockMovementPersistenceData {
  id: string;
  tenantId: string;
  type: string;
  warehouseId: string;
  productId: string;
  quantity: Prisma.Decimal;
  unitCode: string;
  occurredAt: Date;
  referenceType: string | null;
  referenceId: string | null;
  reversesMovementId: string | null;
  createdBy: string;
  note: string | null;
}

/**
 * StockMovementMapper
 *
 * Append-only `StockMovement` domain entity'si ile Prisma `StockMovementRecord`
 * arasındaki dönüşümü sağlar.
 *
 * Not: `stock_movements` tablosu append-only olduğu için fiziksel `is_reversed` kolonu
 * taşımaz; bir hareketin tersine çevrilip çevrilmediği bilgisini repository,
 * `reverses_movement_id = record.id` olan kayıt varlığına bakarak `isReversed` parametresiyle iletir.
 */
export class StockMovementMapper {
  public static toDomain(
    record: StockMovementRecord,
    isReversed: boolean = false,
  ): StockMovement {
    const quantityResult = Quantity.of(
      record.quantity.toString(),
      record.unitCode,
    );
    if (quantityResult.isFailure) {
      throw quantityResult.error;
    }

    let reference: MovementReference | undefined;
    if (record.referenceType && record.referenceId) {
      const refResult = MovementReference.of(
        record.referenceType,
        record.referenceId,
      );
      if (refResult.isFailure) {
        throw refResult.error;
      }
      reference = refResult.value;
    }

    return StockMovement.reconstitute({
      id: record.id,
      tenantId: record.tenantId,
      type: record.type as StockMovementType,
      warehouseId: record.warehouseId,
      productId: record.productId,
      quantity: quantityResult.value,
      occurredAt: record.occurredAt,
      reference,
      reversesMovementId: record.reversesMovementId ?? undefined,
      isReversed,
      createdBy: record.createdBy,
      note: record.note ?? undefined,
    });
  }

  public static toPersistence(
    movement: StockMovement,
  ): StockMovementPersistenceData {
    return {
      id: movement.id,
      tenantId: movement.tenantId,
      type: movement.type,
      warehouseId: movement.warehouseId,
      productId: movement.productId,
      quantity: new Prisma.Decimal(movement.quantity.amount.toString()),
      unitCode: movement.quantity.unit,
      occurredAt: movement.occurredAt,
      referenceType: movement.reference?.type ?? null,
      referenceId: movement.reference?.id ?? null,
      reversesMovementId: movement.reversesMovementId ?? null,
      createdBy: movement.createdBy,
      note: movement.note ?? null,
    };
  }
}

