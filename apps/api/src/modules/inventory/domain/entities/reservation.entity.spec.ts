import { describe, it, expect } from 'vitest';
import { Quantity } from '../value-objects/quantity.vo.js';
import { MovementReference } from '../value-objects/movement-reference.vo.js';
import { Reservation } from './reservation.entity.js';
import { ReservationStatus } from './reservation-status.enum.js';
import {
  InvalidArgumentError,
  InvalidQuantityError,
  InvalidReservationStatusTransitionError,
  ReservationExpiredError,
} from '../errors/index.js';
import {
  StockReserved,
  StockReservationReleased,
  StockReservationConsumed,
} from '../events/index.js';

describe('Reservation Aggregate', () => {
  const tenantId = 'tenant-123';
  const warehouseId = 'wh-main';
  const productId = 'prod-sku-001';
  const validQuantity = Quantity.of(10, 'ADET').value;
  const validReference = MovementReference.of('ORDER', 'ord-456').value;

  describe('Creation (create)', () => {
    it('should create an active reservation with StockReserved event', () => {
      const resResult = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
      });

      expect(resResult.isSuccess).toBe(true);
      const reservation = resResult.value;
      expect(reservation.status).toBe(ReservationStatus.ACTIVE);
      expect(reservation.isActive()).toBe(true);
      expect(reservation.isReleased()).toBe(false);
      expect(reservation.isConsumed()).toBe(false);
      expect(reservation.consumedMovementId).toBeNull();
      expect(reservation.version).toBe(1);

      const events = reservation.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(StockReserved);
      const event = events[0] as StockReserved;
      expect(event.eventName).toBe('StockReserved');
      expect(event.eventVersion).toBe(1);
      expect(event.aggregateId).toBe(reservation.id);
      expect(event.tenantId).toBe(tenantId);
      expect(event.quantity.amount).toBe('10');
      expect(event.quantity.unit).toBe('ADET');
      expect(event.reference.type).toBe('ORDER');
      expect(event.reference.id).toBe('ord-456');
    });

    it('should reject creation with empty required fields', () => {
      const missingTenant = Reservation.create({
        tenantId: '',
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
      });
      expect(missingTenant.isFailure).toBe(true);
      expect(missingTenant.error).toBeInstanceOf(InvalidArgumentError);

      const zeroQty = Quantity.of(0, 'ADET').value;
      const invalidQty = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: zeroQty,
        reference: validReference,
      });
      expect(invalidQty.isFailure).toBe(true);
      expect(invalidQty.error).toBeInstanceOf(InvalidQuantityError);
    });

    it('should reject creation if expiration date is in the past', () => {
      const pastDate = new Date(Date.now() - 60000); // 1 dk önce
      const resResult = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
        expiresAt: pastDate,
      });

      expect(resResult.isFailure).toBe(true);
      expect(resResult.error).toBeInstanceOf(InvalidArgumentError);
    });
  });

  describe('State Machine Transitions', () => {
    it('should transition from ACTIVE to RELEASED and record StockReservationReleased event', () => {
      const reservation = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
      }).value;
      reservation.pullDomainEvents(); // İlk oluşturma event'ini temizle

      const releaseResult = reservation.release();
      expect(releaseResult.isSuccess).toBe(true);
      expect(reservation.status).toBe(ReservationStatus.RELEASED);
      expect(reservation.isReleased()).toBe(true);
      expect(reservation.isActive()).toBe(false);

      const events = reservation.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(StockReservationReleased);
      const event = events[0] as StockReservationReleased;
      expect(event.aggregateId).toBe(reservation.id);
      expect(event.eventName).toBe('StockReservationReleased');
    });

    it('should transition from ACTIVE to CONSUMED and record StockReservationConsumed event', () => {
      const reservation = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
      }).value;
      reservation.pullDomainEvents();

      const consumeResult = reservation.consume('mov-out-999');
      expect(consumeResult.isSuccess).toBe(true);
      expect(reservation.status).toBe(ReservationStatus.CONSUMED);
      expect(reservation.isConsumed()).toBe(true);
      expect(reservation.consumedMovementId).toBe('mov-out-999');

      const events = reservation.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(StockReservationConsumed);
      const event = events[0] as StockReservationConsumed;
      expect(event.aggregateId).toBe(reservation.id);
      expect(event.movementId).toBe('mov-out-999');
    });

    it('should reject consumption if movementId is empty', () => {
      const reservation = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
      }).value;

      const consumeResult = reservation.consume('   ');
      expect(consumeResult.isFailure).toBe(true);
      expect(consumeResult.error).toBeInstanceOf(InvalidArgumentError);
    });

    it('should reject transitions from RELEASED (terminal state)', () => {
      const reservation = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
      }).value;
      reservation.release();

      // RELEASED -> RELEASED tekrar denemesi
      const secondRelease = reservation.release();
      expect(secondRelease.isFailure).toBe(true);
      expect(secondRelease.error).toBeInstanceOf(
        InvalidReservationStatusTransitionError,
      );

      // RELEASED -> CONSUMED denemesi
      const consumeAfterRelease = reservation.consume('mov-123');
      expect(consumeAfterRelease.isFailure).toBe(true);
      expect(consumeAfterRelease.error).toBeInstanceOf(
        InvalidReservationStatusTransitionError,
      );
    });

    it('should reject transitions from CONSUMED (terminal state)', () => {
      const reservation = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
      }).value;
      reservation.consume('mov-123');

      // CONSUMED -> RELEASED denemesi
      const releaseAfterConsume = reservation.release();
      expect(releaseAfterConsume.isFailure).toBe(true);
      expect(releaseAfterConsume.error).toBeInstanceOf(
        InvalidReservationStatusTransitionError,
      );

      // CONSUMED -> CONSUMED tekrar denemesi
      const secondConsume = reservation.consume('mov-456');
      expect(secondConsume.isFailure).toBe(true);
      expect(secondConsume.error).toBeInstanceOf(
        InvalidReservationStatusTransitionError,
      );
    });

    it('should reject consumption if reservation has expired', () => {
      const expiresAt = new Date(Date.now() + 10000); // 10 saniye sonra
      const reservation = Reservation.create({
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
        expiresAt,
      }).value;

      // 15 saniye sonra tüketmeye çalışalım
      const futureDate = new Date(Date.now() + 15000);
      const consumeResult = reservation.consume('mov-123', futureDate);

      expect(consumeResult.isFailure).toBe(true);
      expect(consumeResult.error).toBeInstanceOf(ReservationExpiredError);
    });
  });

  describe('Reconstitution', () => {
    it('should reconstitute reservation without emitting domain events', () => {
      const now = new Date();
      const reservation = Reservation.reconstitute({
        id: 'res-existing-789',
        tenantId,
        warehouseId,
        productId,
        quantity: validQuantity,
        reference: validReference,
        status: ReservationStatus.CONSUMED,
        expiresAt: null,
        consumedMovementId: 'mov-out-456',
        version: 3,
        createdAt: now,
        updatedAt: now,
      });

      expect(reservation.id).toBe('res-existing-789');
      expect(reservation.status).toBe(ReservationStatus.CONSUMED);
      expect(reservation.consumedMovementId).toBe('mov-out-456');
      expect(reservation.version).toBe(3);
      expect(reservation.pullDomainEvents()).toHaveLength(0);
    });
  });
});
