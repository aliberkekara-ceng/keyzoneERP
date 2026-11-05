import { describe, it, expect } from 'vitest';
import { Warehouse } from './warehouse.entity.js';
import { WarehouseCode } from '../value-objects/warehouse-code.vo.js';
import {
  InvalidWarehouseNameError,
  WarehouseInactiveError,
  WarehouseAlreadyActiveError,
  WarehouseAlreadyInactiveError,
} from '../errors/index.js';
import {
  WarehouseCreated,
  WarehouseDeactivated,
} from '../events/index.js';

describe('Warehouse Aggregate Root', () => {
  const validTenantId = 'tenant-123';
  const validCode = WarehouseCode.of('WH-IST-01').value;

  describe('Creation', () => {
    it('should create an active warehouse and record WarehouseCreated event', () => {
      const res = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'İstanbul Merkez Depo',
        allowNegativeStock: false,
      });

      expect(res.isSuccess).toBe(true);
      const wh = res.value;

      expect(wh.id).toBeDefined();
      expect(wh.tenantId).toBe(validTenantId);
      expect(wh.code.equals(validCode)).toBe(true);
      expect(wh.name).toBe('İstanbul Merkez Depo');
      expect(wh.isActive).toBe(true);
      expect(wh.allowNegativeStock).toBe(false);
      expect(wh.version).toBe(1);

      // Event doğrulaması
      const events = wh.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(WarehouseCreated);

      const createdEvent = events[0] as WarehouseCreated;
      expect(createdEvent.aggregateId).toBe(wh.id);
      expect(createdEvent.tenantId).toBe(validTenantId);
      expect(createdEvent.code).toBe('WH-IST-01');
      expect(createdEvent.name).toBe('İstanbul Merkez Depo');

      // pull sonrası event kuyruğu boşalmalı
      expect(wh.pullDomainEvents()).toHaveLength(0);
    });

    it('should reject creation when name is empty', () => {
      const res = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: '   ',
      });

      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InvalidWarehouseNameError);
    });

    it('should reject creation when tenantId is empty', () => {
      const res = Warehouse.create({
        tenantId: '',
        code: validCode,
        name: 'Ana Depo',
      });

      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InvalidWarehouseNameError);
    });
  });

  describe('Renaming', () => {
    it('should rename an active warehouse', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Eski Ad',
      }).value;

      const res = wh.rename('Yeni Ad');
      expect(res.isSuccess).toBe(true);
      expect(wh.name).toBe('Yeni Ad');
    });

    it('should reject renaming with empty name', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Eski Ad',
      }).value;

      const res = wh.rename('  ');
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(InvalidWarehouseNameError);
    });

    it('should reject renaming an inactive warehouse', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Depo',
      }).value;

      wh.deactivate();

      const res = wh.rename('Yeni Depo');
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(WarehouseInactiveError);
    });
  });

  describe('Deactivation & Activation (State Machine)', () => {
    it('should deactivate warehouse and record WarehouseDeactivated event', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Depo',
      }).value;

      wh.pullDomainEvents(); // create event'ini temizle

      const res = wh.deactivate();
      expect(res.isSuccess).toBe(true);
      expect(wh.isActive).toBe(false);

      const events = wh.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(WarehouseDeactivated);
    });

    it('should fail deactivating an already inactive warehouse', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Depo',
      }).value;

      wh.deactivate();

      const secondDeactivate = wh.deactivate();
      expect(secondDeactivate.isFailure).toBe(true);
      expect(secondDeactivate.error).toBeInstanceOf(WarehouseAlreadyInactiveError);
    });

    it('should activate an inactive warehouse', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Depo',
      }).value;

      wh.deactivate();
      expect(wh.isActive).toBe(false);

      const res = wh.activate();
      expect(res.isSuccess).toBe(true);
      expect(wh.isActive).toBe(true);
    });

    it('should fail activating an already active warehouse', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Depo',
      }).value;

      const res = wh.activate();
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(WarehouseAlreadyActiveError);
    });
  });

  describe('Negative Stock Policy', () => {
    it('should update negative stock policy when active', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Depo',
        allowNegativeStock: false,
      }).value;

      const res = wh.changeNegativeStockPolicy(true);
      expect(res.isSuccess).toBe(true);
      expect(wh.allowNegativeStock).toBe(true);
    });

    it('should reject policy change on inactive warehouse', () => {
      const wh = Warehouse.create({
        tenantId: validTenantId,
        code: validCode,
        name: 'Depo',
      }).value;

      wh.deactivate();

      const res = wh.changeNegativeStockPolicy(true);
      expect(res.isFailure).toBe(true);
      expect(res.error).toBeInstanceOf(WarehouseInactiveError);
    });
  });

  describe('Reconstitution (Persistence to Domain)', () => {
    it('should reconstitute existing warehouse without emitting creation events', () => {
      const now = new Date();
      const wh = Warehouse.reconstitute({
        id: 'wh-uuid-1',
        tenantId: 'tenant-1',
        code: validCode,
        name: 'Mevcut Depo',
        isActive: true,
        allowNegativeStock: true,
        version: 5,
        createdAt: now,
        updatedAt: now,
      });

      expect(wh.id).toBe('wh-uuid-1');
      expect(wh.version).toBe(5);
      expect(wh.allowNegativeStock).toBe(true);

      // Veritabanından yüklenen nesne event üretmemelidir
      expect(wh.pullDomainEvents()).toHaveLength(0);
    });
  });
});
