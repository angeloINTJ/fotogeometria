/**
 * What "Desfazer" undoes (PLANO.md §4): the parameters before each change,
 * newest last. A slider dragged from one value to another is one change.
 */
import type { CorrectionParams } from '../core/correction';

/** The parameters before each change, oldest first. */
export type History = readonly CorrectionParams[];

/** How many changes can be undone; older ones are forgotten. */
export const HISTORY_LIMIT = 100;

/**
 * The same parameters, field by field. They are plain data, always built by
 * spreading DEFAULT_PARAMS, so their keys come in one order and their JSON
 * says it all.
 */
export function sameParams(a: CorrectionParams, b: CorrectionParams): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The history after a change from `before` to `after`: `before` is kept, so
 * it can come back. A change that changed nothing is not one.
 */
export function remember(
  history: History,
  before: CorrectionParams,
  after: CorrectionParams,
): History {
  if (sameParams(before, after)) return history;
  return [...history, before].slice(-HISTORY_LIMIT);
}

/** The parameters to go back to and the history without them, or null when there is none. */
export function undo(history: History): { params: CorrectionParams; history: History } | null {
  if (history.length === 0) return null;
  return { params: history[history.length - 1], history: history.slice(0, -1) };
}
