import { Prisma, type StockBalanceRecord } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { StockBalance } from '../../domain/entities/stock-balance.entity.js';

export interface StockBalancePersistenceData {
  tenantId: string;
  warehouseId: string;
  productId: string;
  unitCode: string;
  onHand: Prisma.Decimal;
  reserved: Prisma.Decimal;
  version: number;
}

/**
 * StockBalanceMapper
 *
 * Domain `StockBalance` (`decimal.js` tabanlı) ile Prisma `StockBalanceRecord`
 * (`Prisma.Decimal` / PostgreSQL `NUMERIC(19,4)`) arasında kayıpsız dönüşüm yapar.
 * Dönüşüm `.toString()` üzerinden yapılarak kayan nokta (float) hassasiyet kaybı önlenir.
 */
export class StockBalanceMapper {
  public static toDomain(record: StockBalanceRecord): StockBalance {
    return StockBalance.reconstitute({
      tenantId: record.tenantId,
      warehouseId: record.warehouseId,
      productId: record.productId,
      unit: record.unitCode,
      onHand: new Decimal(record.onHand.toString()),
      reserved: new Decimal(record.reserved.toString()),
      version: record.version,
    });
  }

  public static toPersistence(
    balance: StockBalance,
  ): StockBalancePersistenceData {
    return {
      tenantId: balance.tenantId,
      warehouseId: balance.warehouseId,
      productId: balance.productId,
      unitCode: balance.unit,
      onHand: new Prisma.Decimal(balance.onHand.toString()),
      reserved: new Prisma.Decimal(balance.reserved.toString()),
      version: balance.version,
    };
  }
}

