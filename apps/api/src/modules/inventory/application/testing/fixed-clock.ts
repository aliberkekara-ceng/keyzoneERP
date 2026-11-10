import { ClockPort } from '../ports/clock.port.js';

/**
 * FixedClock
 *
 * Testlerde zamanı sabitlemek ve ileri/geri sarmak için kullanılan sahte saat adaptörü.
 */
export class FixedClock implements ClockPort {
  private _currentTime: Date;

  constructor(initialTime: Date = new Date('2026-11-10T10:00:00.000Z')) {
    this._currentTime = initialTime;
  }

  public now(): Date {
    return new Date(this._currentTime.getTime());
  }

  public setTime(newTime: Date): void {
    this._currentTime = newTime;
  }
}

