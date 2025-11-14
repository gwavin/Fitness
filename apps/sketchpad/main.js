import { loadInitialState } from './state.js';
import { initCanvas } from './canvas.js';
import { initUI } from './ui.js';

async function bootstrap() {
  await loadInitialState();
  const canvas = document.getElementById('canvas');
  const navCanvas = document.getElementById('navCanvas');
  const canvasApi = initCanvas({ canvas, navCanvas });
  initUI({ canvasApi });
}

bootstrap().catch((err) => {
  console.error('Failed to initialise sketchpad', err);
});
