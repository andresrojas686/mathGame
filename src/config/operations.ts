import type { Operation } from '../types';

export interface OperationInfo {
  id: Operation;
  /** Verbo para botones y pestañas: "Multiplicar". */
  label: string;
  /** Sustantivo para cabeceras: "Multiplicación". */
  noun: string;
  symbol: string;
  /** Tecla que la elige en la selección de nivel y en el ranking. */
  key: string;
  /** Multiplica el tiempo por operación, incluido el piso. La división tiene el doble (plan.md §3). */
  timeFactor: number;
}

/** Operaciones en el orden en que se muestran. */
export const OPERATIONS: OperationInfo[] = [
  { id: 'multiplicar', label: 'Multiplicar', noun: 'Multiplicación', symbol: '×', key: 'm', timeFactor: 1 },
  { id: 'dividir', label: 'Dividir', noun: 'División', symbol: '÷', key: 'd', timeFactor: 2 },
  { id: 'sumar', label: 'Sumar', noun: 'Suma', symbol: '+', key: 's', timeFactor: 1 },
  { id: 'restar', label: 'Restar', noun: 'Resta', symbol: '−', key: 'r', timeFactor: 1 },
];

export const OPERATION_IDS: Operation[] = OPERATIONS.map((op) => op.id);

export const OPERATIONS_BY_ID = Object.fromEntries(OPERATIONS.map((op) => [op.id, op])) as Record<Operation, OperationInfo>;

export function isOperation(value: unknown): value is Operation {
  return typeof value === 'string' && (OPERATION_IDS as string[]).includes(value);
}
