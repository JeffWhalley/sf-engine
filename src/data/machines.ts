/**
 * Seed machine profiles. Plan §3.3. Covers a low-power hobby mill, a rigid
 * industrial VMC, a high-RPM router, and a gearbox/manual mill (discrete RPMs).
 */

import type { Machine } from './types';

export const MACHINES: Machine[] = [
  {
    id: 'mill-hobby-1hp',
    name: 'Benchtop Mill (~1 HP)',
    maxRpm: 10000,
    minRpm: 100,
    maxPower_hp: 1.0,
    efficiency: 0.75,
    maxFeed_ipm: 100,
    baseRpm: 5000,
    maxTorque_lbft: 1.05, // 1 hp at 5000 rpm
    rigidity: 'light',
    taper: 'R8',
  },
  {
    id: 'mill-vmc-20hp',
    name: 'Industrial VMC (~20 HP)',
    maxRpm: 12000,
    minRpm: 50,
    maxPower_hp: 20,
    efficiency: 0.85,
    maxFeed_ipm: 600,
    baseRpm: 1500,
    maxTorque_lbft: 70.0, // 20 hp at 1500 rpm
    rigidity: 'rigid',
    taper: 'CAT40',
  },
  {
    id: 'router-3hp',
    name: 'CNC Router (~3 HP, high RPM)',
    maxRpm: 24000,
    minRpm: 6000,
    maxPower_hp: 3,
    efficiency: 0.8,
    maxFeed_ipm: 400,
    baseRpm: 18000,
    maxTorque_lbft: 0.88, // 3 hp at 18000 rpm
    rigidity: 'medium',
    taper: 'ER32',
  },
  {
    id: 'mill-manual-gearbox',
    name: 'Manual Mill (gearbox, fixed speeds)',
    maxRpm: 2720,
    minRpm: 60,
    maxPower_hp: 1.5,
    efficiency: 0.7,
    maxFeed_ipm: 30,
    rigidity: 'medium',
    discreteRpms: [60, 130, 180, 290, 400, 660, 900, 1200, 1800, 2720],
    taper: 'R8',
  },
];

const MACHINE_BY_ID = new Map(MACHINES.map((m) => [m.id, m]));

export function getMachine(id: string): Machine | undefined {
  return MACHINE_BY_ID.get(id);
}
