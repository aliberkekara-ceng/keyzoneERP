import type { WarehouseRecord } from '@prisma/client';
import { Warehouse } from '../../domain/entities/warehouse.entity.js';
import { WarehouseCode } from '../../domain/value-objects/warehouse-code.vo.js';

export interface WarehousePersistenceData {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  isActive: boolean;
  allowNegativeStock: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * WarehouseMapper
 *
 * Saf Domain `Warehouse` aggregate root'u ile Prisma `WarehouseRecord` modeli
 * arasındaki çift yönlü dönüşümü gerçekleştirir.
 * Prisma tiplerinin domain ve application katmanlarına sızmasını engeller (AGENTS.md §2.4).
 */
export class WarehouseMapper {
  public static toDomain(record: WarehouseRecord): Warehouse {
    const codeResult = WarehouseCode.of(record.code);
    if (codeResult.isFailure) {
      throw codeResult.error;
    }

    return Warehouse.reconstitute({
      id: record.id,
      tenantId: record.tenantId,
      code: codeResult.value,
      name: record.name,
      isActive: record.isActive,
      allowNegativeStock: record.allowNegativeStock,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  public static toPersistence(warehouse: Warehouse): WarehousePersistenceData {
    return {
      id: warehouse.id,
      tenantId: warehouse.tenantId,
      code: warehouse.code.value,
      name: warehouse.name,
      isActive: warehouse.isActive,
      allowNegativeStock: warehouse.allowNegativeStock,
      version: warehouse.version,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
    };
  }
}

