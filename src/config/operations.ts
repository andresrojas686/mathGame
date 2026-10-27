import type { ArithOp, Operation } from '../types';

export type OperationKind = 'clasico' | 'mezcla' | 'reto';

export interface OperationInfo {
  id: Operation;
  kind: OperationKind;
  /** Operación aritmética que se practica; no existe en la mezcla, que usa las cuatro. */
  base?: ArithOp;
  /** Verbo para botones y pestañas: "Multiplicar". */
  label: string;
  /** Sustantivo para cabeceras: "Multiplicación", "Reto memoria · Suma". */
  noun: string;
  symbol: string;
  /** Tecla que elige la operación base en la selección de nivel y en el ranking. */
  key: string;
  /** Multiplica el tiempo por operación, incluido el piso. La división tiene el doble (plan.md §3). */
  timeFactor: number;
}

/** Las cuatro operaciones aritméticas, en el orden en que se muestran. */
export const CLASSIC_OPERATIONS: OperationInfo[] = [
  { id: 'multiplicar', kind: 'clasico', base: 'multiplicar', label: 'Multiplicar', noun: 'Multiplicación', symbol: '×', key: 'm', timeFactor: 1 },
  { id: 'dividir', kind: 'clasico', base: 'dividir', label: 'Dividir', noun: 'División', symbol: '÷', key: 'd', timeFactor: 2 },
  { id: 'sumar', kind: 'clasico', base: 'sumar', label: 'Sumar', noun: 'Suma', symbol: '+', key: 's', timeFactor: 1 },
  { id: 'restar', kind: 'clasico', base: 'restar', label: 'Restar', noun: 'Resta', symbol: '−', key: 'r', timeFactor: 1 },
];

export const CLASSIC_OPS: ArithOp[] = CLASSIC_OPERATIONS.map((op) => op.base!);

const MEZCLA: OperationInfo = { id: 'mezcla', kind: 'mezcla', label: 'Mezcla', noun: 'Mezcla', symbol: '×÷+−', key: '', timeFactor: 1 };

/** En el reto el tiempo es fijo (RETO_TIME) y no depende de la operación. */
const RETO_OPERATIONS: OperationInfo[] = CLASSIC_OPERATIONS.map((op) => ({
  ...op,
  id: `reto-${op.base!}` as const,
  kind: 'reto',
  noun: `Reto memoria · ${op.noun}`,
  timeFactor: 1,
}));

export const OPERATIONS: OperationInfo[] = [...CLASSIC_OPERATIONS, MEZCLA, ...RETO_OPERATIONS];

export const OPERATION_IDS: Operation[] = OPERATIONS.map((op) => op.id);

export const OPERATIONS_BY_ID = Object.fromEntries(OPERATIONS.map((op) => [op.id, op])) as Record<Operation, OperationInfo>;

/** Modos de juego en el orden en que se muestran. */
export const MODES: { id: OperationKind; label: string }[] = [
  { id: 'clasico', label: 'Clásico' },
  { id: 'mezcla', label: 'Mezcla' },
  { id: 'reto', label: 'Reto memoria' },
];

/** Operación que corresponde a un modo y una operación base. */
export function operationFor(kind: OperationKind, base: ArithOp): Operation {
  if (kind === 'mezcla') return 'mezcla';
  return kind === 'reto' ? `reto-${base}` : base;
}

export function isOperation(value: unknown): value is Operation {
  return typeof value === 'string' && (OPERATION_IDS as string[]).includes(value);
}
