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
  clearCanvas,
  addColor,
  removeColor
} from './state.js';

function init() {
  const canvasEl = document.getElementById('canvas');
  const engine = new CanvasEngine(canvasEl);

  // --- UI Binding ---

  // Tool menu
  const toolMenu = document.getElementById('toolMenu');
  const toolToggle = document.getElementById('toolToggle');

  function closeToolMenu() {
    toolMenu.classList.remove('open');
  }

  toolToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toolMenu.classList.toggle('open');
  });

  toolMenu.addEventListener('click', (e) => {
    // Prevent clicks on buttons from closing before handlers run
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    if (!toolMenu.contains(e.target) && !toolToggle.contains(e.target)) {
      closeToolMenu();
    }
  });

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

      closeToolMenu();
    });
  });

  // Colors
  const paletteEl = document.getElementById('colorPalette');

  function renderPalette() {
    paletteEl.innerHTML = '';
    state.palette.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'color-btn';
      btn.style.backgroundColor = color;
      btn.onclick = () => setColor(color);
      // Highlight if active
      if (color === state.settings.color) {
          btn.classList.add('active');
      }
      paletteEl.appendChild(btn);
    });
  }

  // Size
  const sizeEl = document.getElementById('brushSize');
  sizeEl.addEventListener('input', (e) => setSize(parseInt(e.target.value)));

  // Actions
  document.getElementById('undoBtn').onclick = undo;
  document.getElementById('redoBtn').onclick = redo;
  document.getElementById('clearBtn').onclick = () => {
    if (confirm('Clear entire drawing?')) clearCanvas();
  };
  const importInput = document.getElementById('importImageInput');
  document.getElementById('importBtn').onclick = () => importInput.click();
  importInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      engine.setBackgroundImage(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  document.getElementById('saveBtn').onclick = () => {
    const link = document.createElement('a');
    link.download = `Mae-Sketch-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = engine.getImageData();
    link.click();
  };

  // Color Picker Logic
  const pickerInput = document.getElementById('colorPickerInput');
  const addColorBtn = document.getElementById('addColorBtn');
  const removeColorBtn = document.getElementById('removeColorBtn');

  addColorBtn.onclick = () => {
      pickerInput.value = state.settings.color; // Start from current color
      pickerInput.click();
  };

  pickerInput.onchange = (e) => {
      addColor(e.target.value);
  };

  removeColorBtn.onclick = () => {
      if (confirm('Remove this color?')) {
          removeColor(state.settings.color);
      }
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
      Array.from(paletteEl.children).forEach((btn, i) => {
        // Find the button that matches the color and set active
        // Or re-render. Since palette can change, better to check by value or re-render if palette order changed.
        // But palette order doesn't change on select.
        const color = state.palette[i];
        btn.classList.toggle('active', color === data);
      });
    }

    if (event === 'palette') {
        renderPalette();
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
  renderPalette(); // Render initial palette
  setColor(state.palette[0]);
  setBrushType('pencil');
}

// Start
init();
