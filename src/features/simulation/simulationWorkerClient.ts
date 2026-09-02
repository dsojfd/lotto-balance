import type { Combination, Draw } from '../../domain/draw';
import type { SimulationGameCount, SimulationMode } from '../../domain/simulation';
import type { SimulationWorkerRequest, SimulationWorkerResponse } from './simulationWorkerProtocol';

export interface SimulationWorkerRun {
  worker: Worker;
  result: Promise<Combination[]>;
}

export function startSimulationWorker(
  count: SimulationGameCount,
  mode: SimulationMode,
  draws: readonly Draw[],
): SimulationWorkerRun {
  const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
  const request: SimulationWorkerRequest = { count, mode, draws };
  const result = new Promise<Combination[]>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.games);
      else reject(new Error(event.data.message));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('게임번호 생성 작업을 실행하지 못했습니다.'));
    };
    worker.postMessage(request);
  });

  return { worker, result };
}
