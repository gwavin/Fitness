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
let pinch = null;
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
  let clientX;
  let clientY;
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
    case 'pencil':
      return 0.95;
    case 'fine':
      return 0.98;
    case 'marker':
      return 0.92;
    case 'highlighter':
      return 0.35;
    default:
      return 1;
  }
}

function strokeWidthFactor(brush) {
  switch (brush) {
    case 'pencil':
      return 0.9;
    case 'fine':
      return 0.5;
    case 'marker':
      return 1.6;
    case 'highlighter':
      return 2.2;
    case 'eraser':
      return 2;
    default:
      return 1;
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
    targetCtx.globalAlpha = 1;
    targetCtx.globalCompositeOperation = 'source-over';
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
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = 'source-over';
}

function rebuildStrokeCache() {
  if (!state.strokes.length) {
    strokeCache = null;
    return;
  }
  const bounds = computeBounds(state.strokes);
  const pad = CACHE_PADDING;
  const width = Math.max(1, bounds.width + pad * 2);
  const height = Math.max(1, bounds.height + pad * 2);
  const cacheDpr = Math.max(1, window.devicePixelRatio || 1);
  const offscreen = createHiDPICanvas(width, height, cacheDpr);
  const offCtx = offscreen.getContext('2d');
  offCtx.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);
  offCtx.translate(-bounds.minX + pad, -bounds.minY + pad);
  for (const stroke of state.strokes) {
    drawStroke(offCtx, stroke);
  }
  strokeCache = {
    canvas: offscreen,
    offset: { x: bounds.minX - pad, y: bounds.minY - pad },
    logicalSize: { width, height },
    dpr: cacheDpr
  };
}

function renderCanvas() {
  if (!canvas || !ctx) return;
  syncCanvasSize();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.zoom, state.zoom);

  if (strokeCache) {
    const { canvas: cacheCanvas, offset, logicalSize } = strokeCache;
    ctx.drawImage(
      cacheCanvas,
      0,
      0,
      cacheCanvas.width,
      cacheCanvas.height,
      offset.x,
      offset.y,
      logicalSize.width,
      logicalSize.height
    );
  } else {
    for (const stroke of state.strokes) {
      drawStroke(ctx, stroke);
    }
  }

  if (currentStroke) {
    drawStroke(ctx, currentStroke);
  }

  ctx.restore();
}

function unionBoxes(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

function drawNavigator() {
  if (!navCanvas || !navCtx || !navigatorEl) return;
  if (navigatorEl.classList.contains('nav-hidden')) return;

  navCtx.setTransform(1, 0, 0, 1, 0, 0);
  navCtx.clearRect(0, 0, navCanvas.width, navCanvas.height);
  navCtx.fillStyle = '#0b0c10';
  navCtx.fillRect(0, 0, navCanvas.width, navCanvas.height);
  navCtx.strokeStyle = '#2a2d36';
  navCtx.strokeRect(0.5, 0.5, navCanvas.width - 1, navCanvas.height - 1);

  const rect = canvas.getBoundingClientRect();
  const topLeftW = screenToWorld(0, 0);
  const bottomRightW = screenToWorld(rect.width, rect.height);
  const viewBox = {
    minX: Math.min(topLeftW.x, bottomRightW.x),
    minY: Math.min(topLeftW.y, bottomRightW.y),
    maxX: Math.max(topLeftW.x, bottomRightW.x),
    maxY: Math.max(topLeftW.y, bottomRightW.y)
  };
  const strokesBoxRaw = state.strokesBounds && state.strokesBounds.width >= 0
    ? state.strokesBounds
    : null;
  const fallback = { minX: -100, minY: -70, maxX: 100, maxY: 70 };
  let box = unionBoxes(strokesBoxRaw || fallback, viewBox);
  const padWorld = 20;
  box = {
    minX: box.minX - padWorld,
    minY: box.minY - padWorld,
    maxX: box.maxX + padWorld,
    maxY: box.maxY + padWorld
  };

  const pad = 10;
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  const sx = (navCanvas.width - pad * 2) / width;
  const sy = (navCanvas.height - pad * 2) / height;
  const scale = Math.min(sx, sy);
  const offsetX = Math.round((navCanvas.width - width * scale) / 2 - box.minX * scale);
  const offsetY = Math.round((navCanvas.height - height * scale) / 2 - box.minY * scale);

  navCtx.fillStyle = '#1a1c24';
  navCtx.fillRect(offsetX + box.minX * scale, offsetY + box.minY * scale, width * scale, height * scale);

  navCtx.lineCap = 'round';
  navCtx.lineJoin = 'round';
  navCtx.globalAlpha = 0.9;

  const strokesSource = strokeCache ? null : state.strokes;
  if (strokeCache) {
    const { canvas: cacheCanvas, logicalSize, offset } = strokeCache;
    navCtx.drawImage(
      cacheCanvas,
      0,
      0,
      cacheCanvas.width,
      cacheCanvas.height,
      offsetX + offset.x * scale,
      offsetY + offset.y * scale,
      logicalSize.width * scale,
      logicalSize.height * scale
    );
  } else {
    for (const stroke of strokesSource) {
      const pts = stroke.points;
      if (!pts || pts.length < 2) continue;
      navCtx.globalCompositeOperation = stroke.brush === 'eraser' ? 'destination-out' : 'source-over';
      navCtx.strokeStyle = stroke.brush === 'eraser' ? '#0b0c10' : (stroke.color || '#fff');
      navCtx.lineWidth = 1.2;
      navCtx.beginPath();
      navCtx.moveTo(offsetX + pts[0].x * scale, offsetY + pts[0].y * scale);
      for (let i = 1; i < pts.length; i += 1) {
        navCtx.lineTo(offsetX + pts[i].x * scale, offsetY + pts[i].y * scale);
      }
      navCtx.stroke();
    }
  }

  navCtx.globalAlpha = 1;
  navCtx.globalCompositeOperation = 'source-over';

  let vx = offsetX + viewBox.minX * scale;
  let vy = offsetY + viewBox.minY * scale;
  let vw = (viewBox.maxX - viewBox.minX) * scale;
  let vh = (viewBox.maxY - viewBox.minY) * scale;

  const clamped = {
    x: Math.max(0, Math.min(vx, navCanvas.width - vw)),
    y: Math.max(0, Math.min(vy, navCanvas.height - vh)),
    w: Math.max(0, Math.min(vw, navCanvas.width)),
    h: Math.max(0, Math.min(vh, navCanvas.height))
  };

  navCtx.fillStyle = 'rgba(54,200,138,0.15)';
  navCtx.fillRect(clamped.x, clamped.y, clamped.w, clamped.h);
  navCtx.strokeStyle = '#36c88a';
  navCtx.lineWidth = 2;
  navCtx.strokeRect(clamped.x + 1, clamped.y + 1, Math.max(0, clamped.w - 2), Math.max(0, clamped.h - 2));

  navMap = { scale, offsetX, offsetY, contentBox: box, navRect: clamped };
}

function redraw() {
  renderCanvas();
  drawNavigator();
}

function hasPoints(stroke) {
  return Boolean(stroke?.points && stroke.points.length > 0);
}

function commitCurrentStroke() {
  if (hasPoints(currentStroke)) {
    addStroke(cloneStroke(currentStroke));
  }
  currentStroke = null;
  drawing = false;
}

function setZoomAt(vx, vy, newZoom) {
  const targetZoom = clamp(newZoom, 0.1, 8);
  const world = screenToWorld(vx, vy);
  const nextPan = {
    x: vx - world.x * targetZoom,
    y: vy - world.y * targetZoom
  };
  setZoom(targetZoom);
  setPan(nextPan);
  if (zoomLevelEl) {
    zoomLevelEl.textContent = `${targetZoom.toFixed(1)}x`;
  }
  redraw();
}

function zoomBy(factor) {
  const rect = canvas.getBoundingClientRect();
  setZoomAt(rect.width / 2, rect.height / 2, state.zoom * factor);
}

function resetView() {
  setZoom(1);
  setPan({ x: 0, y: 0 });
  if (zoomLevelEl) zoomLevelEl.textContent = '1.0x';
  redraw();
}

function fitView() {
  if (!state.strokes.length) {
    resetView();
    return;
  }
  const bounds = state.strokesBounds || computeBounds(state.strokes);
  const rect = canvas.getBoundingClientRect();
  const pad = 40;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const zx = (rect.width - pad * 2) / width;
  const zy = (rect.height - pad * 2) / height;
  const target = clamp(Math.min(zx, zy), 0.1, 8);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  setZoom(target);
  const nextPan = {
    x: rect.width / 2 - cx * target,
    y: rect.height / 2 - cy * target
  };
  setPan(nextPan);
  if (zoomLevelEl) zoomLevelEl.textContent = `${target.toFixed(1)}x`;
  redraw();
}

function toggleNavigator() {
  const hidden = navigatorEl ? navigatorEl.classList.toggle('nav-hidden') : false;
  setNavigatorVisible(!hidden);
  redraw();
}

function setNavigatorVisibility(visible) {
  if (navigatorEl) {
    navigatorEl.classList.toggle('nav-hidden', !visible);
  }
  if (navToggleBtn) {
    navToggleBtn.textContent = visible ? '👁 Hide' : '👁 Show';
  }
}

function startDrawing(e) {
  if (spaceDown || e.button === 1) return;
  if (e.touches && e.touches.length > 1) return;
  e.preventDefault();
  drawing = true;
  if (e.pointerId !== undefined) canvas.setPointerCapture?.(e.pointerId);
  const { vx, vy } = eventToCanvasClient(e);
  const point = screenToWorld(vx, vy);
  const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1;
  currentStroke = {
    brush: state.brush,
    color: state.currentColor,
    size: state.size,
    points: [{ x: point.x, y: point.y, pressure }]
  };
  redraw();
}

function moveDrawing(e) {
  if (isPanning) return;
  if (!drawing || (e.touches && e.touches.length > 1)) return;
  e.preventDefault();
  const { vx, vy } = eventToCanvasClient(e);
  const point = screenToWorld(vx, vy);
  const pressure = e.pressure && e.pressure > 0 ? e.pressure : 1;
  currentStroke.points.push({ x: point.x, y: point.y, pressure });
  redraw();
}

function endDrawing(e) {
  try {
    if (e && e.pointerId !== undefined) canvas.releasePointerCapture?.(e.pointerId);
  } catch (err) {
    // ignore
  }

  if (!drawing) {
    return;
  }

  commitCurrentStroke();
  redraw();
}

function handlePointerDown(e) {
  if (spaceDown || e.button === 1) {
    isPanning = true;
    if (e.pointerId !== undefined) canvas.setPointerCapture?.(e.pointerId);
    lastPan = { x: e.clientX, y: e.clientY };
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
    try {
      if (e.pointerId !== undefined) canvas.releasePointerCapture?.(e.pointerId);
    } catch (err) {
      // ignore
    }
    canvas.style.cursor = spaceDown ? 'grab' : 'crosshair';
    return;
  }
  endDrawing(e);
}

function handleWheel(e) {
  e.preventDefault();
  const factor = Math.pow(1.2, -e.deltaY / 100);
  const rect = canvas.getBoundingClientRect();
  const vx = e.clientX - rect.left;
  const vy = e.clientY - rect.top;
  setZoomAt(vx, vy, state.zoom * factor);
}

function handleDoubleClick(e) {
  const rect = canvas.getBoundingClientRect();
  const vx = e.clientX - rect.left;
  const vy = e.clientY - rect.top;
  const factor = e.shiftKey ? 1 / 1.4 : 1.4;
  setZoomAt(vx, vy, state.zoom * factor);
}

function handleTouchStart(e) {
  if (e.touches.length === 2) {
    e.preventDefault();
    // A second finger means a pinch gesture, so we should stop drawing.
    if (drawing) {
      if (currentStroke) {
        currentStroke.points = [];
      }
      drawing = false;
      redraw(); // Clear any partial stroke that was being drawn.
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
}

function handleTouchMove(e) {
  if (pinch && e.touches.length === 2) {
    e.preventDefault();
    const dist = distance(
      e.touches[0].clientX,
      e.touches[0].clientY,
      e.touches[1].clientX,
      e.touches[1].clientY
    );
    const rect = canvas.getBoundingClientRect();
    const vx = pinch.center.x - rect.left;
    const vy = pinch.center.y - rect.top;
    const newZoom = clamp(pinch.startZoom * (dist / pinch.startDist), 0.1, 8);
    setZoomAt(vx, vy, newZoom);
  }
}

function handleTouchEnd(e) {
  const remainingTouches = e.touches?.length ?? 0;
  if (remainingTouches === 0) {
    if (drawing) {
      commitCurrentStroke();
      redraw();
    }
    pinch = null;
    return;
  }

  if (pinch && remainingTouches < 2) {
    pinch = null;
  }
}

function navToWorld(nx, ny) {
  if (!navMap) return { x: 0, y: 0 };
  const { scale, offsetX, offsetY } = navMap;
  return {
    x: (nx - offsetX) / scale,
    y: (ny - offsetY) / scale
  };
}

function centerViewOnWorld(wx, wy) {
  const rect = canvas.getBoundingClientRect();
  const nextPan = {
    x: rect.width / 2 - wx * state.zoom,
    y: rect.height / 2 - wy * state.zoom
  };
  setPan(nextPan);
  redraw();
}

function handleNavigatorPointerDown(e) {
  if (!navCanvas) return;
  const bb = navCanvas.getBoundingClientRect();
  const x = (e.clientX - bb.left) * (navCanvas.width / bb.width);
  const y = (e.clientY - bb.top) * (navCanvas.height / bb.height);
  if (navMap) {
    const r = navMap.navRect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      if (e.pointerId !== undefined) navCanvas.setPointerCapture?.(e.pointerId);
      navDragState.dragging = true;
      navDragState.offset = { x: x - r.x, y: y - r.y };
    } else {
      const world = navToWorld(x, y);
      centerViewOnWorld(world.x, world.y);
    }
  }
}

const navDragState = {
  dragging: false,
  offset: { x: 0, y: 0 }
};

function handleNavigatorPointerMove(e) {
  if (!navDragState.dragging || !navMap) return;
  const bb = navCanvas.getBoundingClientRect();
  const x = (e.clientX - bb.left) * (navCanvas.width / bb.width);
  const y = (e.clientY - bb.top) * (navCanvas.height / bb.height);
  const halfW = navMap.navRect.w / 2;
  const halfH = navMap.navRect.h / 2;
  const cx = Math.max(halfW, Math.min(x - navDragState.offset.x + halfW, navCanvas.width - halfW));
  const cy = Math.max(halfH, Math.min(y - navDragState.offset.y + halfH, navCanvas.height - halfH));
  const world = navToWorld(cx, cy);
  centerViewOnWorld(world.x, world.y);
}

function handleNavigatorPointerUp(e) {
  if (navDragState.dragging) {
    navDragState.dragging = false;
    try {
      if (e.pointerId !== undefined) navCanvas.releasePointerCapture?.(e.pointerId);
    } catch (err) {
      // ignore
    }
  }
}

function handleKeyDown(e) {
  if (e.code === 'Space') {
    spaceDown = true;
    canvas.style.cursor = isPanning ? 'grabbing' : 'grab';
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    zoomBy(1.2);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    zoomBy(1 / 1.2);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    resetView();
  }
  if (e.key.toLowerCase() === 'n') {
    toggleNavigator();
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    commitCurrentStroke();
    undoStroke();
    redraw();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault();
    commitCurrentStroke();
    redoStroke();
    redraw();
  }
}

function handleKeyUp(e) {
  if (e.code === 'Space') {
    spaceDown = false;
    canvas.style.cursor = isPanning ? 'grabbing' : 'crosshair';
  }
}

function saveVisiblePNG() {
  commitCurrentStroke();
  redraw();
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const octx = output.getContext('2d');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, output.width, output.height);
  octx.drawImage(canvas, 0, 0);
  return output;
}

function saveFullDrawingCanvas() {
  commitCurrentStroke();
  const bounds = state.strokesBounds || computeBounds(state.strokes);
  if (!bounds || !state.strokes.length) {
    return null;
  }
  const pad = 20;
  const width = Math.max(1, Math.ceil(bounds.width + pad * 2));
  const height = Math.max(1, Math.ceil(bounds.height + pad * 2));
  const fullDpr = Math.max(1, window.devicePixelRatio || 1);
  const out = createHiDPICanvas(width, height, fullDpr);
  const octx = out.getContext('2d');
  octx.setTransform(fullDpr, 0, 0, fullDpr, 0, 0);
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, width, height);
  octx.translate(-bounds.minX + pad, -bounds.minY + pad);
  for (const stroke of state.strokes) {
    drawStroke(octx, stroke);
  }
  return {
    canvas: out,
    logicalWidth: width,
    logicalHeight: height
  };
}

export function initCanvas({ canvas: canvasEl, navCanvas: navEl }) {
  canvas = canvasEl;
  navCanvas = navEl;
  if (!canvas) throw new Error('Canvas element missing');
  ctx = canvas.getContext('2d', { willReadFrequently: false });
  zoomLevelEl = document.getElementById('zoomLevel');
  undoBtn = document.getElementById('undoBtn');
  redoBtn = document.getElementById('redoBtn');
  navigatorEl = document.getElementById('navigator');
  navToggleBtn = document.getElementById('navToggle');
  navFitBtn = document.getElementById('navFit');
  navCtx = navCanvas ? navCanvas.getContext('2d') : null;

  syncCanvasSize();
  canvas.style.cursor = 'crosshair';
  if (zoomLevelEl) zoomLevelEl.textContent = `${state.zoom.toFixed(1)}x`;

  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  window.addEventListener('pointerup', handlePointerUp, { passive: true });
  window.addEventListener('pointercancel', handlePointerUp, { passive: true });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('dblclick', handleDoubleClick);
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });

  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp, { passive: true });

  if (undoBtn) undoBtn.addEventListener('click', () => {
    commitCurrentStroke();
    undoStroke();
    redraw();
  });
  if (redoBtn) redoBtn.addEventListener('click', () => {
    commitCurrentStroke();
    redoStroke();
    redraw();
  });
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const resetViewBtn = document.getElementById('resetView');
  const fitViewBtn = document.getElementById('fitView');
  zoomInBtn?.addEventListener('click', () => zoomBy(1.2));
  zoomOutBtn?.addEventListener('click', () => zoomBy(1 / 1.2));
  resetViewBtn?.addEventListener('click', resetView);
  fitViewBtn?.addEventListener('click', fitView);

  if (navToggleBtn) navToggleBtn.addEventListener('click', toggleNavigator);
  if (navFitBtn) navFitBtn.addEventListener('click', fitView);
  if (navCanvas) {
    navCanvas.addEventListener('pointerdown', handleNavigatorPointerDown);
    navCanvas.addEventListener('pointermove', handleNavigatorPointerMove);
    window.addEventListener('pointerup', handleNavigatorPointerUp, { passive: true });
  }

  window.addEventListener('resize', () => {
    syncCanvasSize();
    redraw();
  });

  setNavigatorVisibility(state.navigatorVisible);

  on('strokeschange', () => {
    rebuildStrokeCache();
    redraw();
  });
  on('historychange', ({ canUndo, canRedo }) => {
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  });
  on('zoomchange', (zoomValue) => {
    if (zoomLevelEl) zoomLevelEl.textContent = `${zoomValue.toFixed(1)}x`;
  });
  on('panchange', () => redraw());
  on('navigatorchange', (visible) => setNavigatorVisibility(visible));

  rebuildStrokeCache();
  redraw();

  if (undoBtn) undoBtn.disabled = state.strokes.length === 0;
  if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;

  // Provide default swatches if none exist handled in UI
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
