import { Warehouse } from '../../domain/entities/warehouse.entity.js';
import { WarehouseCode } from '../../domain/value-objects/warehouse-code.vo.js';
import { WarehouseRepositoryPort } from '../ports/warehouse.repository.port.js';

/**
 * InMemoryWarehouseRepository
 *
 * YALNIZCA testlerde kullanılan bellek-içi (RAM) sahte repository.
 * Dışarıdan PostgreSQL/Prisma gereksinimi olmadan handler'ı saliseler içinde test etmeyi sağlar.
 */
export class InMemoryWarehouseRepository implements WarehouseRepositoryPort {
  private readonly items: Map<string, Warehouse> = new Map();

  private makeKey(tenantId: string, idOrCode: string): string {
    return `${tenantId}::${idOrCode}`;
  }

  public async findById(
    tenantId: string,
    id: string,
  ): Promise<Warehouse | null> {
    const key = this.makeKey(tenantId, id);
    const item = this.items.get(key);
    return item ?? null;
  }

  public async findByCode(
    tenantId: string,
    code: WarehouseCode,
  ): Promise<Warehouse | null> {
    for (const item of this.items.values()) {
      if (item.tenantId === tenantId && item.code.equals(code)) {
        return item;
      }
    }
    return null;
  }

  public async existsByCode(
    tenantId: string,
    code: WarehouseCode,
  ): Promise<boolean> {
    const found = await this.findByCode(tenantId, code);
    return found !== null;
  }

  public async save(warehouse: Warehouse): Promise<void> {
    const key = this.makeKey(warehouse.tenantId, warehouse.id);
    this.items.set(key, warehouse);
  }

  // Test yardımcı metotları
  public clear(): void {
    this.items.clear();
  }

  public getAll(): Warehouse[] {
    return Array.from(this.items.values());
  }
}

