/**
 * Speeds & Feeds data layer — public API (Phase 2).
 *
 * Depends on the engine (resolve.ts calls computeMilling). The UI imports from
 * here to list materials/tools/machines and to run calculations from selections.
 */

export * from './types';
export * from './materials';
export * from './tools';
export * from './machines';
export * from './resolve';
export * from './cuttingSeeds';
export * from './machinePresets';
export * from './mfrOverrides';
export * from './limits';
