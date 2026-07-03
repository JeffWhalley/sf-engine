/**
 * Validation helpers.
 *
 * Engine guarantee: valid inputs never produce NaN/Infinity, and invalid
 * inputs throw a descriptive EngineError (never silently return garbage).
 */

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

/** Throws unless `value` is a finite number > 0. */
export function assertPositive(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new EngineError(`${name} must be a positive finite number, got ${value}`);
  }
}

/** Throws unless `value` is a finite number >= 0. */
export function assertNonNegative(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new EngineError(`${name} must be a non-negative finite number, got ${value}`);
  }
}

/** Throws unless `value` is a finite number within [min, max] inclusive. */
export function assertInRange(name: string, value: number, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new EngineError(`${name} must be within [${min}, ${max}], got ${value}`);
  }
}

/** Throws unless finite; returns the value (chainable). */
export function requireFinite(value: number, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new EngineError(`${name} must be a finite number, got ${value}`);
  }
  return value;
}

/** Throws unless finite and > 0; returns the value (chainable). */
export function requirePositive(value: number, name: string): number {
  requireFinite(value, name);
  if (value <= 0) {
    throw new EngineError(`${name} must be > 0, got ${value}`);
  }
  return value;
}

/** Throws unless finite and >= 0; returns the value (chainable). */
export function requireNonNegative(value: number, name: string): number {
  requireFinite(value, name);
  if (value < 0) {
    throw new EngineError(`${name} must be >= 0, got ${value}`);
  }
  return value;
}
