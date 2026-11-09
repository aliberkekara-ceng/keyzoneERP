import { Warehouse } from '../../domain/entities/warehouse.entity.js';
import { WarehouseCode } from '../../domain/value-objects/warehouse-code.vo.js';

/**
 * WarehouseRepositoryPort
 *
 * Warehouse Aggregate Root için kalıcılık (persistence) sözleşmesidir.
 * Prisma veya veritabanı detayları içermez; saf domain nesneleriyle çalışır.
 */
export interface WarehouseRepositoryPort {
  findById(tenantId: string, id: string): Promise<Warehouse | null>;
  findByCode(tenantId: string, code: WarehouseCode): Promise<Warehouse | null>;
  existsByCode(tenantId: string, code: WarehouseCode): Promise<boolean>;
  save(warehouse: Warehouse): Promise<void>;
}

