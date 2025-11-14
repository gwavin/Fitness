import {
  state,
  QUICK_COLORS,
  setCurrentColor,
  setBrush,
  setSize,
  overwriteSwatches,
  upsertSwatch,
  clearSwatches,
  replaceStrokes,
  on
} from './state.js';
import {
  createToastManager,
  downloadBlob,
  waitForFileRead
} from './utils.js';

const SWATCH_BAR_SLOTS = 12;
const SWATCH_GRID_SLOTS = 32;

function hexToInputColor(col) {
  try {
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 1;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const toHex = (v) => v.toString(16).padStart(2, '0');
    return `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`;
  } catch (err) {
    return '#000000';
  }
}

function normaliseImportedStrokes(data) {
  if (!data) return [];
  const payload = Array.isArray(data) ? { strokes: data } : data;
  if (!Array.isArray(payload.strokes)) return [];
  return payload.strokes
    .filter((stroke) => stroke && Array.isArray(stroke.points))
    .map((stroke) => ({
      brush: stroke.brush || 'pencil',
      color: stroke.color || '#000000',
      size: Number.isFinite(stroke.size) ? stroke.size : 4,
      points: stroke.points
        .filter((pt) => typeof pt?.x === 'number' && typeof pt?.y === 'number')
        .map((pt) => ({
          x: pt.x,
          y: pt.y,
          pressure: Number.isFinite(pt.pressure) ? pt.pressure : 1
        }))
    }))
    .filter((stroke) => stroke.points.length > 0);
}

function buildExportPayload() {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    strokes: state.strokes,
    swatches: state.swatches,
    palette: {
      currentColor: state.currentColor,
      brush: state.brush,
      size: state.size
    }
  };
}

async function downloadCanvasPNG(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not export canvas'));
        return;
      }
      downloadBlob(filename, blob);
      resolve();
    }, 'image/png');
  });
}

function ensureDefaultSwatches() {
  if (state.swatches.length > 0) return;
  overwriteSwatches([
    '#000000', '#ffffff', '#ff595e', '#ffca3a', '#8ac926', '#1982c4',
    '#6a4c93', '#f15bb5', '#06d6a0', '#ffd166', '#8338ec', '#3a86ff'
  ]);
}

export function initUI({ canvasApi }) {
  const paletteModal = document.getElementById('paletteModal');
  const paletteBtn = document.getElementById('paletteBtn');
  const closePaletteBtn = document.getElementById('closePalette');
  const colorPicker = document.getElementById('colorPicker');
  const quickGrid = document.getElementById('quickGrid');
  const swatchGrid = document.getElementById('swatchGrid');
  const swatchBar = document.getElementById('swatchBar');
  const addSwatchBtn = document.getElementById('addSwatch');
  const clearSwatchesBtn = document.getElementById('clearSwatches');
  const clearCanvasBtn = document.getElementById('clearCanvasBtn');
  const brushesEl = document.getElementById('brushes');
  const sizeRange = document.getElementById('size');
  const saveBtn = document.getElementById('saveBtn');
  const saveFullBtn = document.getElementById('saveFullBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const exportFromModalBtn = document.getElementById('exportFromModal');
  const importFromModalBtn = document.getElementById('importFromModal');
  const importFile = document.getElementById('importFile');
  const toastEl = document.getElementById('toast');

  const toast = createToastManager(toastEl);

  ensureDefaultSwatches();

  function openPalette() {
    colorPicker.value = hexToInputColor(state.currentColor);
    paletteModal.classList.add('open');
    paletteModal.setAttribute('aria-hidden', 'false');
  }

  function closePalette() {
    paletteModal.classList.remove('open');
    paletteModal.setAttribute('aria-hidden', 'true');
  }

  paletteBtn?.addEventListener('click', openPalette);
  closePaletteBtn?.addEventListener('click', closePalette);
  paletteModal?.addEventListener('click', (e) => {
    if (e.target === paletteModal) closePalette();
  });

  colorPicker?.addEventListener('input', (e) => {
    setCurrentColor(e.target.value);
  });

  function renderQuickColors() {
    if (!quickGrid) return;
    quickGrid.innerHTML = '';
    QUICK_COLORS.forEach((color) => {
      const btn = document.createElement('button');
      btn.className = `quick-cell${color === state.currentColor ? ' active' : ''}`;
      btn.style.background = color;
      btn.title = color;
      btn.addEventListener('click', () => setCurrentColor(color));
      quickGrid.appendChild(btn);
    });
  }

  function renderSwatchBar() {
    if (!swatchBar) return;
    swatchBar.innerHTML = '';
    for (let i = 0; i < SWATCH_BAR_SLOTS; i += 1) {
      const swatch = state.swatches[i];
      const btn = document.createElement('button');
      btn.className = `swatch${swatch ? '' : ' empty'}${swatch === state.currentColor ? ' active' : ''}`;
      btn.style.background = swatch || 'transparent';
      btn.title = swatch || 'Empty slot';
      btn.addEventListener('click', () => {
        if (swatch) {
          setCurrentColor(swatch);
        } else {
          upsertSwatch(i, state.currentColor);
        }
      });
      let timer;
      btn.addEventListener('pointerdown', () => {
        timer = setTimeout(() => {
          upsertSwatch(i, state.currentColor);
        }, 550);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
        btn.addEventListener(evt, () => timer && clearTimeout(timer));
      });
      swatchBar.appendChild(btn);
    }
    const openBtn = document.createElement('button');
    openBtn.className = 'swatch palette';
    openBtn.title = 'Open colours & brushes';
    openBtn.addEventListener('click', openPalette);
    swatchBar.appendChild(openBtn);
  }

  function renderSwatchGrid() {
    if (!swatchGrid) return;
    swatchGrid.innerHTML = '';
    for (let i = 0; i < SWATCH_GRID_SLOTS; i += 1) {
      const color = state.swatches[i];
      const cell = document.createElement('button');
      cell.className = `cell${color ? '' : ' empty'}`;
      if (color) cell.style.background = color;
      cell.title = color || 'Empty slot';
      cell.addEventListener('click', () => {
        if (color) {
          setCurrentColor(color);
        } else {
          upsertSwatch(i, state.currentColor);
        }
      });
      let timer;
      cell.addEventListener('pointerdown', () => {
        timer = setTimeout(() => {
          upsertSwatch(i, state.currentColor);
        }, 550);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
        cell.addEventListener(evt, () => timer && clearTimeout(timer));
      });
      swatchGrid.appendChild(cell);
    }
  }

  addSwatchBtn?.addEventListener('click', () => {
    const next = [...state.swatches];
    if (next.length >= SWATCH_GRID_SLOTS) {
      toast.show('All swatch slots are full');
      return;
    }
    next.push(state.currentColor);
    overwriteSwatches(next);
    toast.show('Colour saved');
  });

  clearSwatchesBtn?.addEventListener('click', () => {
    if (!window.confirm('Remove all saved colours?')) return;
    clearSwatches();
    ensureDefaultSwatches();
    toast.show('Colours cleared');
  });

  clearCanvasBtn?.addEventListener('click', () => {
    if (!window.confirm('Clear the entire drawing? This cannot be undone.')) return;
    canvasApi.clearDrawing();
    toast.show('Drawing cleared', { duration: 2000 });
  });

  brushesEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-brush]');
    if (!btn) return;
    setBrush(btn.dataset.brush);
  });

  sizeRange?.addEventListener('input', (e) => {
    setSize(parseInt(e.target.value, 10));
  });

  function renderBrushButtons() {
    if (!brushesEl) return;
    [...brushesEl.querySelectorAll('button')].forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.brush === state.brush);
    });
  }

  function updateSizeRange() {
    if (!sizeRange) return;
    sizeRange.value = String(state.size);
  }

  function updateColorUI() {
    renderQuickColors();
    renderSwatchBar();
    if (colorPicker) {
      colorPicker.value = hexToInputColor(state.currentColor);
    }
  }

  async function handleSaveView() {
    try {
      const outCanvas = canvasApi.saveVisiblePNG();
      const filename = `MaesSketchpad-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      await downloadCanvasPNG(outCanvas, filename);
      toast.show('Saved current view');
    } catch (err) {
      console.error(err);
      toast.show('Failed to save image', { variant: 'error', duration: 4000 });
    }
  }

  async function handleSaveFull() {
    try {
      const full = canvasApi.saveFullDrawingCanvas();
      if (!full) {
        toast.show('Nothing to export yet');
        return;
      }
      const filename = `MaesSketchpad-full-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      await downloadCanvasPNG(full.canvas, filename);
      toast.show('Saved full drawing');
    } catch (err) {
      console.error(err);
      toast.show('Failed to save full drawing', { variant: 'error', duration: 4000 });
    }
  }

  function handleExportJSON() {
    canvasApi.commitCurrentStroke();
    const payload = buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const filename = `MaesSketchpad-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    downloadBlob(filename, blob);
    toast.show('Exported drawing data');
  }

  async function handleImportJSON(file) {
    if (!file) return;
    try {
      const text = await waitForFileRead(file);
      const json = JSON.parse(text);
      const strokes = normaliseImportedStrokes(json);
      if (!strokes.length) throw new Error('No strokes found in file');
      replaceStrokes(strokes);
      if (json?.swatches && Array.isArray(json.swatches)) {
        overwriteSwatches(json.swatches.filter((c) => typeof c === 'string'));
      }
      if (json?.palette) {
        if (json.palette.currentColor) setCurrentColor(json.palette.currentColor);
        if (json.palette.brush) setBrush(json.palette.brush);
        if (json.palette.size) setSize(Number(json.palette.size));
      }
      toast.show('Imported drawing');
    } catch (err) {
      console.error(err);
      toast.show('Import failed. Ensure the file is a valid sketchpad export.', {
        variant: 'error',
        duration: 4500
      });
    } finally {
      if (importFile) importFile.value = '';
    }
  }

  saveBtn?.addEventListener('click', handleSaveView);
  saveFullBtn?.addEventListener('click', handleSaveFull);
  exportBtn?.addEventListener('click', handleExportJSON);
  exportFromModalBtn?.addEventListener('click', handleExportJSON);
  importBtn?.addEventListener('click', () => importFile?.click());
  importFromModalBtn?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', (e) => {
    const [file] = e.target.files || [];
    handleImportJSON(file);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key?.toLowerCase?.() === 'p' || e.key?.toLowerCase?.() === 'c') {
      e.preventDefault();
      openPalette();
    }
    if (e.key?.toLowerCase?.() === 'e') {
      setBrush('eraser');
    }
  });

  renderQuickColors();
  renderSwatchBar();
  renderSwatchGrid();
  renderBrushButtons();
  updateSizeRange();
  updateColorUI();

  on('colorchange', updateColorUI);
  on('swatchchange', () => {
    renderSwatchBar();
    renderSwatchGrid();
  });
  on('brushchange', renderBrushButtons);
  on('sizechange', updateSizeRange);
}
