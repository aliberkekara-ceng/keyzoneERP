import { describe, it, expect } from 'vitest';
import {
  WarehouseCreated,
  WarehouseDeactivated,
  StockReceived,
  StockIssued,
  StockTransferred,
  StockAdjusted,
  StockReserved,
  StockReservationReleased,
  StockReservationConsumed,
} from './index.js';
import { IDomainEvent } from '../../../../shared/kernel/domain-event.js';

describe('Domain Events Suite', () => {
  const sampleDate = new Date('2026-11-05T12:00:00.000Z');

  const events: IDomainEvent[] = [
    new WarehouseCreated('wh-1', 'tenant-1', 'WH-01', 'Ana Depo', sampleDate),
    new WarehouseDeactivated('wh-1', 'tenant-1', sampleDate),
    new StockReceived(
      'mov-1',
      'tenant-1',
      'wh-1',
      'prod-1',
      { amount: '50.0000', unit: 'KG' },
      { type: 'PURCHASE_INVOICE', id: 'inv-101' },
      sampleDate,
    ),
    new StockIssued(
      'mov-2',
      'tenant-1',
      'wh-1',
      'prod-1',
      { amount: '10.0000', unit: 'KG' },
      { type: 'ORDER', id: 'ord-202' },
      sampleDate,
    ),
    new StockTransferred(
      'trf-1',
      'tenant-1',
      'wh-1',
      'wh-2',
      'prod-1',
      { amount: '15.0000', unit: 'KG' },
      sampleDate,
    ),
    new StockAdjusted(
      'mov-3',
      'tenant-1',
      'wh-1',
      'prod-1',
      'OUT',
      { amount: '2.5000', unit: 'KG' },
      'Hasarlı ürün hurdaya ayrıldı',
      sampleDate,
    ),
    new StockReserved(
      'res-1',
      'tenant-1',
      'wh-1',
      'prod-1',
      { amount: '20.0000', unit: 'KG' },
      { type: 'ORDER', id: 'ord-303' },
      new Date('2026-11-06T12:00:00.000Z'),
      sampleDate,
    ),
    new StockReservationReleased(
      'res-1',
      'tenant-1',
      'wh-1',
      'prod-1',
      { amount: '20.0000', unit: 'KG' },
      sampleDate,
    ),
    new StockReservationConsumed(
      'res-1',
      'tenant-1',
      'wh-1',
      'prod-1',
      { amount: '20.0000', unit: 'KG' },
      'mov-4',
      sampleDate,
    ),
  ];

  it('all events should have past-tense names (*ed / *Created / *Deactivated / etc.)', () => {
    for (const event of events) {
      expect(event.eventName).toMatch(/(Created|Deactivated|Received|Issued|Transferred|Adjusted|Reserved|Released|Consumed)$/);
    }
  });

  it('all events should specify eventVersion = 1 for event evolution', () => {
    for (const event of events) {
      expect(event.eventVersion).toBe(1);
    }
  });

  it('all event payloads should be purely JSON serializable without losing decimal precision', () => {
    for (const event of events) {
      const jsonString = JSON.stringify(event);
      expect(jsonString).toBeDefined();

      const parsed = JSON.parse(jsonString);
      expect(parsed.eventName).toBe(event.eventName);
      expect(parsed.eventVersion).toBe(1);
      expect(parsed.aggregateId).toBe(event.aggregateId);

      // Quantities, if present, must preserve exact string format for precision
      if ('quantity' in parsed) {
        expect(typeof parsed.quantity.amount).toBe('string');
        expect(typeof parsed.quantity.unit).toBe('string');
      }
    }
  });
});

