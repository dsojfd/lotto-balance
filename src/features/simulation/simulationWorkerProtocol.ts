import type { Combination, Draw } from '../../domain/draw';
import type { SimulationGameCount, SimulationMode } from '../../domain/simulation';

export interface SimulationWorkerRequest {
  count: SimulationGameCount;
  mode: SimulationMode;
  draws: readonly Draw[];
}

export type SimulationWorkerResponse =
  | { ok: true; games: Combination[] }
  | { ok: false; message: string };
