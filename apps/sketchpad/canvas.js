import {
  state,
  setZoom,
  setPan,
  setNavigatorVisible,
  addStroke,
  undo as undoStroke,
  redo as redoStroke,
  clearStrokes,
  computeBounds,
  on
} from './state.js';
import {
  clamp,
  distance,
  createHiDPICanvas,
  cloneStroke
} from './utils.js';

let canvas;
let ctx;
let navCanvas;
let navCtx;
let navigatorEl;
let zoomLevelEl;
let undoBtn;
let redoBtn;
let navToggleBtn;
let navFitBtn;
let dpr = 1;
let currentStroke = null;
let drawing = false;
let isPanning = false;
let spaceDown = false;
let lastPan = { x: 0, y: 0 };
let pinch = null;               // now only used for two-finger pinch
let strokeCache = null;
let navMap = null;

const CACHE_PADDING = 64;

function syncCanvasSize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function screenToWorld(vx, vy) {
  return {
    x: (vx - state.pan.x) / state.zoom,
    y: (vy - state.pan.y) / state.zoom
  };
}

function eventToCanvasClient(e) {
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;
  if (e.touches && e.touches[0]) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    vx: clientX - rect.left,
    vy: clientY - rect.top
  };
}

function strokeAlpha(brush) {
  switch (brush) {
    case 'pencil': return 0.95;
    case 'fine': return 0.98;
    case 'marker': return 0.92;
    case 'highlighter': return 0.35;
    default: return 1;
  }
}

function strokeWidthFactor(brush) {
  switch (brush) {
    case 'pencil': return 0.9;
    case 'fine': return 0.5;
    case 'marker': return 1.6;
    case 'highlighter': return 2.2;
    case 'eraser': return 2;
    default: return 1;
  }
}

function drawStroke(targetCtx, stroke) {
  const { points } = stroke;
  if (!points || points.length === 0) return;
  const isEraser = stroke.brush === 'eraser';
  targetCtx.save();
  targetCtx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  if (!isEraser) targetCtx.strokeStyle = stroke.color || '#000';
  targetCtx.globalAlpha = strokeAlpha(stroke.brush);
  targetCtx.lineCap = 'round';
  targetCtx.lineJoin = 'round';

  const base = Math.max(0.5, stroke.size * strokeWidthFactor(stroke.brush));

  if (points.length === 1) {
    const p = points[0];
    const pressure = p.pressure ?? 1;
    targetCtx.lineWidth = Math.max(1, base * pressure);
    targetCtx.beginPath();
    targetCtx.moveTo(p.x, p.y);
    targetCtx.lineTo(p.x + 0.01, p.y + 0.01);
    targetCtx.stroke();
    targetCtx.restore();
    return;
  }

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const pressure = ((prev.pressure ?? 1) + (curr.pressure ?? 1)) / 2;
    targetCtx.lineWidth = Math.max(1, base * pressure);
    targetCtx.beginPath();
    targetCtx.moveTo(prev.x, prev.y);
    targetCtx.lineTo(curr.x, curr.y);
    targetCtx.stroke();
  }

  targetCtx.restore();
}

// ... rebuildStrokeCache, renderCanvas, drawNavigator, etc. unchanged ...

function commitCurrentStroke() {
  if (currentStroke?.points?.length > 0) {
    addStroke(cloneStroke(currentStroke));
  }
  currentStroke = null;
  drawing = false;
}

function startDrawing(e) {
  if (spaceDown || e.button === 1) return;

  // REMOVED: if (e.touches && e.touches.length > 1) return;
  // PointerEvents from touch never have .touches, and we handle pinch separately now.

  e.preventDefault();
  drawing = true;
  if (e.pointerId !== undefined) canvas.setPointerCapture(e.pointerId);

  const { vx, vy } = eventToCanvasClient(e);
  const world = screenToWorld(vx, vy);
  const pressure = e.pressure > 0 ? e.pressure : 1;

  currentStroke = {
    brush: state.brush,
    color: state.currentColor,
    size: state.size,
    points: [{ x: world.x, y: world.y, pressure }]
  };
  redraw();
}

function moveDrawing(e) {
  if (!drawing || isPanning) return;
  e.preventDefault();

  const { vx, vy } = eventToCanvasClient(e);
  const world = screenToWorld(vx, vy);
  const pressure = e.pressure > 0 ? e.pressure : 1;

  currentStroke.points.push({ x: world.x, y: world.y, pressure });
  redraw();
}

function endDrawing() {
  if (!drawing) return;
  commitCurrentStroke();
  redraw();
}

// Pointer handlers (now the ONLY path for drawing – works with mouse, pen, and single-finger touch)
function handlePointerDown(e) {
  if (spaceDown || e.button === 1) {
    isPanning = true;
    lastPan = { x: e.clientX, y: e.clientY };
    if (e.pointerId !== undefined) canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }
  startDrawing(e);
}

function handlePointerMove(e) {
  if (isPanning) {
    const dx = e.clientX - lastPan.x;
    const dy = e.clientY - lastPan.y;
    lastPan = { x: e.clientX, y: e.clientY };
    setPan({ x: state.pan.x + dx, y: state.pan.y + dy });
    canvas.style.cursor = 'grabbing';
    redraw();
    return;
  }
  moveDrawing(e);
}

function handlePointerUp(e) {
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = spaceDown ? 'grab' : 'crosshair';
    try { canvas.releasePointerCapture?.(e.pointerId); } catch {}
    return;
  }
  endDrawing();
}

// NEW: Pure pinch-zoom handlers that do NOT interfere with drawing
function pinchStart(e) {
  if (e.touches.length !== 2) return;
  e.preventDefault();

  // Cancel any active drawing stroke
  if (drawing) {
    currentStroke = null;
    drawing = false;
    redraw();
  }

  const [a, b] = e.touches;
  pinch = {
    startDist: distance(a.clientX, a.clientY, b.clientX, b.clientY),
    startZoom: state.zoom,
    center: {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2
    }
  };
}

function pinchMove(e) {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();

  const dist = distance(e.touches[0].clientX, e.touches[0].clientY,
                        e.touches[1].clientX, e.touches[1].clientY);

  const rect = canvas.getBoundingClientRect();
  const vx = pinch.center.x - rect.left;
  const vy = pinch.center.y - rect.top;

  const newZoom = clamp(pinch.startZoom * (dist / pinch.startDist), 0.1, 8);
  setZoomAt(vx, vy, newZoom);
}

function pinchEnd(e) {
  if (pinch && (e.touches?.length ?? 0) < 2) {
    pinch = null;
  }
}

// ... all the zoom / navigator / key handlers unchanged ...

export function initCanvas({ canvas: canvasEl, navCanvas: navEl }) {
  canvas = canvasEl;
  navCanvas = navEl;
  if (!canvas) throw new Error('Canvas element missing');
  ctx = canvas.getContext('2d', { willReadFrequently: false });
  navCtx = navCanvas?.getContext('2d');

  // ... element lookup unchanged ...

  syncCanvasSize();
  canvas.style.cursor = 'crosshair';
  if (zoomLevelEl) zoomLevelEl.textContent = `${state.zoom.toFixed(1)}x`;

  // === POINTER EVENTS ONLY for drawing and panning (mouse + touch + pen) ===
  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  window.addEventListener('pointerup', handlePointerUp, { passive: true });
  window.addEventListener('pointercancel', handlePointerUp, { passive: true });

  // === SEPARATE pinch-zoom (two fingers) – does NOT block pointer events ===
  canvas.addEventListener('touchstart', pinchStart, { passive: false });
  canvas.addEventListener('touchmove', pinchMove, { passive: false });
  canvas.addEventListener('touchend', pinchEnd, { passive: true });
  canvas.addEventListener('touchcancel', pinchEnd, { passive: true });

  // Wheel, dblclick, keys, buttons – unchanged
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('dblclick', handleDoubleClick);
  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp, { passive: true });

  // ... rest of button listeners, resize, state listeners unchanged ...

  rebuildStrokeCache();
  redraw();

  return {
    redraw,
    resetView,
    fitView,
    zoomBy,
    setZoomAt,
    toggleNavigator,
    saveVisiblePNG,
    saveFullDrawingCanvas,
    commitCurrentStroke,
    clearDrawing: () => {
      commitCurrentStroke();
      clearStrokes();
      rebuildStrokeCache();
      redraw();
    }
  };
}
