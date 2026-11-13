import { Prisma, type PrismaClient } from '@prisma/client';
import { Warehouse } from '../../domain/entities/warehouse.entity.js';
import { WarehouseCode } from '../../domain/value-objects/warehouse-code.vo.js';
import {
  OptimisticLockError,
  WarehouseCodeAlreadyExistsError,
} from '../../domain/errors/index.js';
import { WarehouseRepositoryPort } from '../../application/ports/warehouse.repository.port.js';
import { WarehouseMapper } from './warehouse.mapper.js';
import {
  PrismaTransactionContext,
  type PrismaTransactionClient,
} from './prisma-transaction-context.js';

/**
 * PrismaWarehouseRepository
 *
 * `WarehouseRepositoryPort` sözleşmesinin Prisma/PostgreSQL implementasyonudur.
 * Dışarıya asla Prisma modeli sızdırmaz; `WarehouseMapper` ile domain nesnesi döner.
 * Güncellemelerde `version` alanı üzerinden Optimistic Concurrency Control uygular.
 */
export class PrismaWarehouseRepository implements WarehouseRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  private get client(): PrismaClient | PrismaTransactionClient {
    return PrismaTransactionContext.getClient(this.prisma);
  }

  public async findById(
    tenantId: string,
    id: string,
  ): Promise<Warehouse | null> {
    const record = await this.client.warehouseRecord.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!record) {
      return null;
    }

    return WarehouseMapper.toDomain(record);
  }

  public async findByCode(
    tenantId: string,
    code: WarehouseCode,
  ): Promise<Warehouse | null> {
    const record = await this.client.warehouseRecord.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: code.value,
        },
      },
    });

    if (!record) {
      return null;
    }

    return WarehouseMapper.toDomain(record);
  }

  public async existsByCode(
    tenantId: string,
    code: WarehouseCode,
  ): Promise<boolean> {
    const count = await this.client.warehouseRecord.count({
      where: {
        tenantId,
        code: code.value,
      },
    });

    return count > 0;
  }

  public async save(warehouse: Warehouse): Promise<void> {
    const data = WarehouseMapper.toPersistence(warehouse);
    const client = this.client;

    const existing = await client.warehouseRecord.findUnique({
      where: { id: data.id },
      select: { id: true },
    });

    if (!existing) {
      try {
        await client.warehouseRecord.create({
          data: {
            ...data,
            version: 1,
          },
        });
        return;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new WarehouseCodeAlreadyExistsError(data.tenantId, data.code);
        }
        throw error;
      }
    }

    // Mevcut kayıt güncellenirken iyimser kilitleme (Optimistic Locking) uygulanır
    const updated = await client.warehouseRecord.updateMany({
      where: {
        id: data.id,
        tenantId: data.tenantId,
        version: data.version,
      },
      data: {
        name: data.name,
        isActive: data.isActive,
        allowNegativeStock: data.allowNegativeStock,
        version: data.version + 1,
        updatedAt: data.updatedAt,
      },
    });

    if (updated.count === 0) {
      throw new OptimisticLockError('Warehouse', data.id, data.version);
    }
  }
}

