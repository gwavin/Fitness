import { CanvasEngine } from './canvas.js';
import {
  state,
  subscribe,
  setTool,
  setBrushType,
  setColor,
  setSize,
  undo,
  redo,
  clearCanvas
} from './state.js';

// Palette Colors
const COLORS = [
  '#2d3436', // Black
  '#ff7675', // Coral
  '#fd79a8', // Pink
  '#6c5ce7', // Purple
  '#0984e3', // Blue
  '#00cec9', // Teal
  '#00b894', // Green
  '#fdcb6e', // Yellow
  '#e17055', // Orange
];

function init() {
  const canvasEl = document.getElementById('canvas');
  const engine = new CanvasEngine(canvasEl);

  // --- UI Binding ---

  // Tools
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      const brush = btn.dataset.brush;

      if (tool === 'brush' && brush) {
        setBrushType(brush);
      } else {
        setTool(tool);
      }
    });
  });

  // Colors
  const paletteEl = document.getElementById('colorPalette');
  COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.style.backgroundColor = color;
    btn.onclick = () => setColor(color);
    paletteEl.appendChild(btn);
  });

  // Size
  const sizeEl = document.getElementById('brushSize');
  sizeEl.addEventListener('input', (e) => setSize(parseInt(e.target.value)));

  // Actions
  document.getElementById('undoBtn').onclick = undo;
  document.getElementById('redoBtn').onclick = redo;
  document.getElementById('clearBtn').onclick = () => {
    if (confirm('Clear entire drawing?')) clearCanvas();
  };
  document.getElementById('saveBtn').onclick = () => {
    const link = document.createElement('a');
    link.download = `Mae-Sketch-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = engine.getImageData();
    link.click();
  };

  // --- State Subscriptions ---

  subscribe((event, data) => {
    if (event === 'tool' || event === 'brush') {
      // Update active tool UI
      document.querySelectorAll('.tool-btn').forEach(btn => {
        const isMatch = (btn.dataset.tool === state.settings.tool) &&
          (!btn.dataset.brush || btn.dataset.brush === state.settings.brushType);
        btn.classList.toggle('active', isMatch);
      });
    }

    if (event === 'color') {
      // Update active color UI
      Array.from(paletteEl.children).forEach(btn => {
        // Convert rgb to hex for comparison if needed, or just check style
        // Simple check:
        const isActive = btn.style.backgroundColor === 'rgb(45, 52, 54)' && data === '#2d3436'; // Edge case for black
        // Better to just re-render or track index, but for now:
        // Let's just rely on the loop
      });

      // Actually, let's just toggle class based on index or value
      Array.from(paletteEl.children).forEach((btn, i) => {
        btn.classList.toggle('active', COLORS[i] === data);
      });
    }

    if (event === 'history') {
      document.getElementById('undoBtn').disabled = state.strokes.length === 0;
      document.getElementById('redoBtn').disabled = state.redoStack.length === 0;
    }

    if (event === 'camera') {
      const indicator = document.getElementById('zoomIndicator');
      indicator.textContent = `${Math.round(data.zoom * 100)}%`;
      indicator.classList.add('visible');

      // Debounce hide
      clearTimeout(window.zoomTimer);
      window.zoomTimer = setTimeout(() => {
        indicator.classList.remove('visible');
      }, 1500);
    }

    if (event === 'draw') {
      engine.requestRender();
    }
  });

  // Initial State Trigger
  setColor(COLORS[0]);
  setBrushType('pencil');
}

// Start
init();
