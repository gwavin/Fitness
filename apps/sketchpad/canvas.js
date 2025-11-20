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
let zoomLevelEl;
let dpr = 1;
let currentStroke = null;
let drawingPointerId = null;
let drawing = false;
let isPanning = false;
let spaceDown = false;
let lastPan = { x: 0, y: 0 };
let pinch = null;
const activePointers = new Map();

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
  return {
    vx: (e.clientX - rect.left) * dpr,
    vy: (e.clientY - rect.top) * dpr
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

  targetCtx.beginPath();
  for (let i = 1; i < points.length; i += 1) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const pressure = p1.pressure ?? 1;
    targetCtx.lineWidth = Math.max(1, base * pressure);
    targetCtx.moveTo(p0.x, p0.y);
    targetCtx.lineTo(p1.x, p1.y);
  }
  targetCtx.stroke();
  targetCtx.restore();
}

function redraw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.zoom, state.zoom);

  state.strokes.forEach((stroke) => drawStroke(ctx, stroke));
  if (currentStroke) drawStroke(ctx, currentStroke);
  ctx.restore();
}

function commitCurrentStroke() {
  if (currentStroke?.points?.length) {
    addStroke(cloneStroke(currentStroke));
  }
  currentStroke = null;
  drawing = false;
  drawingPointerId = null;
}

function startDrawing(e) {
  if (spaceDown || e.button === 1 || e.button === 2) return;
  drawing = true;
  drawingPointerId = e.pointerId;
  canvas.setPointerCapture?.(e.pointerId);

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
  if (!drawing || drawingPointerId !== e.pointerId) return;
  const { vx, vy } = eventToCanvasClient(e);
  const world = screenToWorld(vx, vy);
  const pressure = e.pressure > 0 ? e.pressure : 1;
  currentStroke.points.push({ x: world.x, y: world.y, pressure });
  redraw();
}

function endDrawing(e) {
  if (drawingPointerId !== null && e.pointerId !== drawingPointerId) return;
  if (!drawing) return;
  commitCurrentStroke();
  redraw();
}

function startPan(e) {
  isPanning = true;
  lastPan = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = 'grabbing';
  canvas.setPointerCapture?.(e.pointerId);
}

function updatePan(e) {
  const dx = (e.clientX - lastPan.x) * dpr;
  const dy = (e.clientY - lastPan.y) * dpr;
  lastPan = { x: e.clientX, y: e.clientY };
  setPan({ x: state.pan.x + dx, y: state.pan.y + dy });
  redraw();
}

function endPan() {
  isPanning = false;
  canvas.style.cursor = spaceDown ? 'grab' : 'crosshair';
}

function setZoomAt(vx, vy, newZoom) {
  const clamped = clamp(newZoom, 0.1, 8);
  const scaleChange = clamped / state.zoom;
  const newPan = {
    x: vx - (vx - state.pan.x) * scaleChange,
    y: vy - (vy - state.pan.y) * scaleChange
  };
  setZoom(clamped);
  setPan(newPan);
  redraw();
}

function handleWheel(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const { vx, vy } = eventToCanvasClient(e);
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoomAt(vx, vy, state.zoom * zoomFactor);
  } else {
    e.preventDefault();
    setPan({ x: state.pan.x - e.deltaX * dpr, y: state.pan.y - e.deltaY * dpr });
    redraw();
  }
}

function startPinch() {
  if (activePointers.size !== 2) return;
  const [a, b] = Array.from(activePointers.values());
  pinch = {
    startDist: distance(a.clientX, a.clientY, b.clientX, b.clientY),
    startZoom: state.zoom,
    center: {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2
    }
  };
  commitCurrentStroke();
}

function updatePinch() {
  if (!pinch || activePointers.size !== 2) return;
  const [a, b] = Array.from(activePointers.values());
  const dist = distance(a.clientX, a.clientY, b.clientX, b.clientY);
  const rect = canvas.getBoundingClientRect();
  const vx = (pinch.center.x - rect.left) * dpr;
  const vy = (pinch.center.y - rect.top) * dpr;
  const newZoom = pinch.startZoom * (dist / pinch.startDist);
  setZoomAt(vx, vy, newZoom);
}

function clearPinchIfNeeded() {
  if (activePointers.size < 2) pinch = null;
}

function handlePointerDown(e) {
  activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

  if (spaceDown || e.button === 1) {
    startPan(e);
    return;
  }

  if (activePointers.size === 2) {
    startPinch();
    return;
  }

  startDrawing(e);
}

function handlePointerMove(e) {
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
  }

  if (pinch) {
    e.preventDefault();
    updatePinch();
    return;
  }

  if (isPanning) {
    e.preventDefault();
    updatePan(e);
    return;
  }

  moveDrawing(e);
}

function handlePointerUp(e) {
  activePointers.delete(e.pointerId);

  if (pinch) {
    clearPinchIfNeeded();
    return;
  }

  if (isPanning) {
    endPan();
    return;
  }

  endDrawing(e);
}

function handlePointerCancel(e) {
  activePointers.delete(e.pointerId);
  if (pinch) clearPinchIfNeeded();
  if (drawingPointerId === e.pointerId) commitCurrentStroke();
  isPanning = false;
  drawing = false;
  drawingPointerId = null;
  redraw();
}

function handleKeyDown(e) {
  if (e.key === ' ' && !spaceDown) {
    spaceDown = true;
    canvas.style.cursor = 'grab';
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) redoStroke();
    else undoStroke();
    redraw();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redoStroke();
    redraw();
  }
  if (e.key === '-' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomBy(0.8); }
  if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomBy(1.2); }
  if (e.key === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); resetView(); }
}

function handleKeyUp(e) {
  if (e.key === ' ') {
    spaceDown = false;
    if (!isPanning) canvas.style.cursor = 'crosshair';
  }
}

function zoomBy(factor) {
  const center = { vx: canvas.width / 2, vy: canvas.height / 2 };
  setZoomAt(center.vx, center.vy, state.zoom * factor);
}

function resetView() {
  setZoom(1);
  setPan({ x: 0, y: 0 });
  redraw();
}

function fitView() {
  const bounds = computeBounds(state.strokes);
  if (!bounds) return;
  const { minX, minY, maxX, maxY } = bounds;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w === 0 || h === 0) return;

  const padding = 40;
  const scale = Math.min(
    (canvas.width - padding * 2) / w,
    (canvas.height - padding * 2) / h
  );
  const newZoom = clamp(scale, 0.1, 5);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  setZoom(newZoom);
  setPan({
    x: canvas.width / 2 - midX * newZoom,
    y: canvas.height / 2 - midY * newZoom
  });
  redraw();
}

function drawNavigator() {
  if (!navCtx || !navCanvas) return;
  navCtx.clearRect(0, 0, navCanvas.width, navCanvas.height);
  const bounds = computeBounds(state.strokes);
  if (!bounds) return;
  const { minX, minY, maxX, maxY } = bounds;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return;

  navCtx.save();
  navCtx.fillStyle = '#ffffff';
  navCtx.fillRect(0, 0, navCanvas.width, navCanvas.height);
  const scale = Math.min(navCanvas.width / (w + 100), navCanvas.height / (h + 100));
  navCtx.translate(navCanvas.width / 2, navCanvas.height / 2);
  navCtx.scale(scale, scale);
  navCtx.translate(-(minX + w / 2), -(minY + h / 2));
  state.strokes.forEach((stroke) => drawStroke(navCtx, stroke));
  navCtx.restore();
}

function saveVisiblePNG() {
  const out = createHiDPICanvas(canvas.width, canvas.height, 1 / dpr);
  const outCtx = out.getContext('2d');
  outCtx.fillStyle = '#fff';
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

function saveFullDrawingCanvas() {
  const bounds = computeBounds(state.strokes);
  if (!bounds) return saveVisiblePNG();
  const padding = 40;
  const width = Math.max(1, Math.ceil(bounds.maxX - bounds.minX + padding * 2));
  const height = Math.max(1, Math.ceil(bounds.maxY - bounds.minY + padding * 2));
  const out = createHiDPICanvas(width, height, 1);
  const outCtx = out.getContext('2d');
  outCtx.fillStyle = '#fff';
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.save();
  outCtx.translate(padding - bounds.minX, padding - bounds.minY);
  state.strokes.forEach((stroke) => drawStroke(outCtx, stroke));
  outCtx.restore();
  return { canvas: out };
}

export function initCanvas({ canvas: canvasEl, navCanvas: navEl }) {
  canvas = canvasEl;
  navCanvas = navEl;
  if (!canvas) throw new Error('Canvas element missing');
  ctx = canvas.getContext('2d');
  navCtx = navCanvas?.getContext('2d');
  zoomLevelEl = document.getElementById('zoomLevel');

  syncCanvasSize();
  canvas.style.cursor = 'crosshair';
  if (zoomLevelEl) zoomLevelEl.textContent = `${state.zoom.toFixed(1)}x`;

  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  canvas.addEventListener('pointerup', handlePointerUp, { passive: true });
  canvas.addEventListener('pointercancel', handlePointerCancel, { passive: true });
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('pointerup', handlePointerUp, { passive: true });
  window.addEventListener('pointercancel', handlePointerCancel, { passive: true });
  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp, { passive: true });
  window.addEventListener('resize', () => {
    syncCanvasSize();
    redraw();
  });

  on('strokechange', () => {
    redraw();
    drawNavigator();
  });
  on('viewchange', () => {
    if (zoomLevelEl) zoomLevelEl.textContent = `${state.zoom.toFixed(1)}x`;
    redraw();
  });

  redraw();
  drawNavigator();

  return {
    redraw,
    resetView,
    fitView,
    zoomBy,
    setZoomAt,
    toggleNavigator: () => setNavigatorVisible(!state.navigatorVisible),
    saveVisiblePNG,
    saveFullDrawingCanvas,
    commitCurrentStroke,
    clearDrawing: () => {
      commitCurrentStroke();
      clearStrokes();
      redraw();
      drawNavigator();
    }
  };
}
