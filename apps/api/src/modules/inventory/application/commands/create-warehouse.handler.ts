import { Result } from '../../../../shared/kernel/result.js';
import { Warehouse } from '../../domain/entities/warehouse.entity.js';
import { WarehouseCode } from '../../domain/value-objects/warehouse-code.vo.js';
import {
  DomainError,
  WarehouseCodeAlreadyExistsError,
} from '../../domain/errors/index.js';
import { WarehouseRepositoryPort } from '../ports/warehouse.repository.port.js';
import { UnitOfWorkPort } from '../ports/unit-of-work.port.js';
import { CreateWarehouseCommand } from './create-warehouse.command.js';
import { CreateWarehouseResult } from './create-warehouse.result.js';

/**
 * CreateWarehouseHandler
 *
 * Yeni bir depo oluşturma akışını orkestre eden Use Case (Command Handler).
 * İş kurallarını çalıştırmak için Warehouse Aggregate'ine delege eder.
 */
export class CreateWarehouseHandler {
  constructor(
    private readonly warehouseRepo: WarehouseRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  public async execute(
    command: CreateWarehouseCommand,
  ): Promise<Result<CreateWarehouseResult, DomainError>> {
    // 1. Value Object oluşturma ve format doğrulaması
    const codeResult = WarehouseCode.of(command.code);
    if (codeResult.isFailure) {
      return Result.fail(codeResult.error);
    }
    const warehouseCode = codeResult.value; 

    // 2. Tenant içinde depo kodunun benzersizlik kontrolü (Port üzerinden)
    const exists = await this.warehouseRepo.existsByCode(
      command.tenantId,
      warehouseCode,
    );
    if (exists) {
      return Result.fail(
        new WarehouseCodeAlreadyExistsError(command.tenantId, warehouseCode.value),
      );
    }

    // 3. Warehouse Aggregate Root'unun üretilmesi (Domain doğrulamaları)
    const warehouseResult = Warehouse.create({
      tenantId: command.tenantId,
      code: warehouseCode,
      name: command.name,
      allowNegativeStock: command.allowNegativeStock ?? false,
    });
    if (warehouseResult.isFailure) {
      return Result.fail(warehouseResult.error);
    }
    const warehouse = warehouseResult.value;

    // 4. Atomik kayıt (Unit of Work üzerinden)
    await this.unitOfWork.execute(async () => {
      await this.warehouseRepo.save(warehouse);
    });

    // 5. İstemciye DTO sonucunun dönülmesi
    return Result.ok({
      id: warehouse.id,
      code: warehouse.code.value,
      name: warehouse.name,
      isActive: warehouse.isActive,
      allowNegativeStock: warehouse.allowNegativeStock,
    });
  }
}

