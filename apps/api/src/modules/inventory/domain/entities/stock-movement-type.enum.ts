export const StockMovementType = {
  RECEIPT: 'RECEIPT',
  ISSUE: 'ISSUE',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
} as const;

export type StockMovementType =
  (typeof StockMovementType)[keyof typeof StockMovementType];

export const MovementDirection = {
  IN: 'IN',
  OUT: 'OUT',
} as const;

export type MovementDirection =
  (typeof MovementDirection)[keyof typeof MovementDirection];

export function getMovementDirection(type: StockMovementType): MovementDirection {
  switch (type) {
    case StockMovementType.RECEIPT:
    case StockMovementType.TRANSFER_IN:
    case StockMovementType.ADJUSTMENT_IN:
      return MovementDirection.IN;
    case StockMovementType.ISSUE: 
    case StockMovementType.TRANSFER_OUT:
    case StockMovementType.ADJUSTMENT_OUT:
      return MovementDirection.OUT;
  }
}

export function getOppositeMovementType(type: StockMovementType): StockMovementType {
  switch (type) {
    case StockMovementType.RECEIPT:
      return StockMovementType.ADJUSTMENT_OUT;
    case StockMovementType.ISSUE:
      return StockMovementType.ADJUSTMENT_IN;
    case StockMovementType.TRANSFER_OUT:
      return StockMovementType.TRANSFER_IN;
    case StockMovementType.TRANSFER_IN:
      return StockMovementType.TRANSFER_OUT;
    case StockMovementType.ADJUSTMENT_IN:
      return StockMovementType.ADJUSTMENT_OUT;
    case StockMovementType.ADJUSTMENT_OUT:
      return StockMovementType.ADJUSTMENT_IN;
  }
}

