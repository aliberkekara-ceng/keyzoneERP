/**
 * CreateWarehouseCommand
 *
 * Yeni depo oluşturma kullanım senaryosu için girdi DTO'su.
 * İstemciden gelen saf veridir; nesne referansı taşımaz.
 */
export interface CreateWarehouseCommand {
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly allowNegativeStock?: boolean;
}

