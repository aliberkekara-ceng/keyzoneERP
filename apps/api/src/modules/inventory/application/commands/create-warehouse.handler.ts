import { Result } from '../../../../shared/kernel/result.js';
import { Warehouse } from '../../domain/entities/warehouse.entity.js';
import { WarehouseCode } from '../../domain/value-objects/warehouse-code.vo.js';
import {
  DomainError,
  InsufficientPermissionError,
  WarehouseCodeAlreadyExistsError,
} from '../../domain/errors/index.js';
import { WarehouseRepositoryPort } from '../ports/warehouse.repository.port.js';
import { UnitOfWorkPort } from '../ports/unit-of-work.port.js';
import { ClockPort } from '../ports/clock.port.js';
import {
  CurrentTenantPort,
  InventoryPermissions,
} from '../ports/current-tenant.port.js';
import { CreateWarehouseCommand } from './create-warehouse.command.js';
import { CreateWarehouseResult } from './create-warehouse.result.js';

/**
 * CreateWarehouseHandler
 *
 * Yeni bir depo oluşturma akışını orkestre eden Use Case (Command Handler).
 * Akış: Yetki kontrolü → Format doğrulaması → Benzersizlik kontrolü → Aggregate üretimi → Kayıt + Event toplama.
 */
export class CreateWarehouseHandler {
  constructor(
    private readonly warehouseRepo: WarehouseRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly clock: ClockPort,
    private readonly currentTenant: CurrentTenantPort,
  ) {}

  public async execute(
    command: CreateWarehouseCommand,
  ): Promise<Result<CreateWarehouseResult, DomainError>> {
    // 1. Yetki kontrolü (AGENTS.md §4 ve §9: Yetki application katmanında zorunludur)
    if (!this.currentTenant.hasPermission(InventoryPermissions.WAREHOUSE_MANAGE)) {
      return Result.fail(
        new InsufficientPermissionError(InventoryPermissions.WAREHOUSE_MANAGE),
      );
    }

    const tenantId = command.tenantId ?? this.currentTenant.getTenantId();

    // 2. Value Object oluşturma ve format doğrulaması
    const codeResult = WarehouseCode.of(command.code);
    if (codeResult.isFailure) {
      return Result.fail(codeResult.error);
    }
    const warehouseCode = codeResult.value;

    // 3. Tenant içinde depo kodunun benzersizlik kontrolü (Port üzerinden)
    const exists = await this.warehouseRepo.existsByCode(
      tenantId,
      warehouseCode,
    );
    if (exists) {
      return Result.fail(
        new WarehouseCodeAlreadyExistsError(tenantId, warehouseCode.value),
      );
    }

    // 4. Warehouse Aggregate Root'unun üretilmesi (ClockPort zamanı ile)
    const now = this.clock.now();
    const warehouseResult = Warehouse.create({
      tenantId,
      code: warehouseCode,
      name: command.name,
      allowNegativeStock: command.allowNegativeStock ?? false,
      createdAt: now,
    });
    if (warehouseResult.isFailure) {
      return Result.fail(warehouseResult.error);
    }
    const warehouse = warehouseResult.value;

    // 5. Atomik kayıt ve domain event'lerinin toplanması (Unit of Work üzerinden)
    await this.unitOfWork.execute(async () => {
      await this.warehouseRepo.save(warehouse);
      this.unitOfWork.collectEvents(warehouse.pullDomainEvents());
    });

    // 6. İstemciye DTO sonucunun dönülmesi
    return Result.ok({
      id: warehouse.id,
      code: warehouse.code.value,
      name: warehouse.name,
      isActive: warehouse.isActive,
      allowNegativeStock: warehouse.allowNegativeStock,
    });
  }
}
