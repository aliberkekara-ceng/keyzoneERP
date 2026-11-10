/**
 * CreateWarehouseCommand
 *
 * Yeni depo oluşturma kullanım senaryosu için girdi DTO'su.
 * İstemciden gelen saf veridir; nesne referansı taşımaz.
 * tenantId opsiyoneldir; verilmezse CurrentTenantPort üzerinden alınır.
 */
export interface CreateWarehouseCommand {
  readonly tenantId?: string;
  readonly code: string;
  readonly name: string;
  readonly allowNegativeStock?: boolean;
}
