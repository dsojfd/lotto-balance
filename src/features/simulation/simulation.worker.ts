import { CryptoRandomSource } from '../../domain/random';
import { generateSimulationPortfolio } from '../../domain/simulation';
import type { SimulationWorkerRequest, SimulationWorkerResponse } from './simulationWorkerProtocol';

self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  let response: SimulationWorkerResponse;
  try {
    response = {
      ok: true,
      games: generateSimulationPortfolio(
        event.data.count,
        event.data.mode,
        event.data.draws,
        new CryptoRandomSource(),
      ),
    };
  } catch (caught) {
    response = {
      ok: false,
      message: caught instanceof Error ? caught.message : '게임번호를 생성하지 못했습니다.',
    };
  }
  self.postMessage(response);
};
