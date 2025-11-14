import { clamp } from './utils.js';

const STORAGE_KEYS = {
  zoom: 'maesSketchpad.zoom.v2',
  pan: 'maesSketchpad.pan.v2',
  navigator: 'maesSketchpad.navigator.visible.v1',
  color: 'maesketchpad.currentColor',
  brush: 'maesketchpad.brush',
  size: 'maesketchpad.size',
  swatches: 'maesketchpad.swatches.v1',
  strokesBackup: 'maesketchpad.strokes.v1'
};

const DB_CONFIG = {
  name: 'maes-sketchpad',
  version: 1,
  store: 'sketchpad'
};

const DEFAULTS = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  navigatorVisible: true,
  currentColor: '#3a86ff',
  brush: 'pencil',
  size: 8,
  swatches: [],
  strokes: [],
  redoStack: []
};

const QUICK_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#FF9F43', '#00D2D3', '#74B9FF', '#00B894', '#E17055',
  '#FD79A8', '#6C5CE7', '#A29BFE', '#FD9843', '#FDCB6E',
  '#E8F5E8', '#FFF5EE', '#F0F8FF', '#FFE4E1', '#F5FFFA'
];

const emitter = new EventTarget();
let dbPromise = null;

export const state = {
  zoom: DEFAULTS.zoom,
  pan: { ...DEFAULTS.pan },
  navigatorVisible: DEFAULTS.navigatorVisible,
  currentColor: DEFAULTS.currentColor,
  brush: DEFAULTS.brush,
  size: DEFAULTS.size,
  swatches: [...DEFAULTS.swatches],
  strokes: [...DEFAULTS.strokes],
  redoStack: [...DEFAULTS.redoStack],
  strokesBounds: null
};

export { QUICK_COLORS };

function emit(type, detail) {
  emitter.dispatchEvent(new CustomEvent(type, { detail }));
}

function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(DB_CONFIG.store)) {
          db.createObjectStore(DB_CONFIG.store);
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    });
  }
  return dbPromise;
}

async function loadStrokesFromIndexedDB() {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_CONFIG.store, 'readonly');
      const store = tx.objectStore(DB_CONFIG.store);
      const request = store.get('strokes');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('IndexedDB get failed'));
    });
  } catch (err) {
    console.warn('[Sketchpad] Failed to read from IndexedDB', err);
    return null;
  }
}

async function saveStrokesToIndexedDB(strokes) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_CONFIG.store, 'readwrite');
      const store = tx.objectStore(DB_CONFIG.store);
      const request = store.put(strokes, 'strokes');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('IndexedDB put failed'));
    });
  } catch (err) {
    console.warn('[Sketchpad] Failed to write to IndexedDB', err);
  }
}

function loadPan() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.pan) || '{"x":0,"y":0}');
  } catch (err) {
    return { ...DEFAULTS.pan };
  }
}

function loadSwatches() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.swatches) || '[]');
  } catch (err) {
    return [];
  }
}

function loadNavigatorVisibility() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.navigator);
    return raw === null ? true : raw === '1';
  } catch (err) {
    return true;
  }
}

function loadViewZoom() {
  const raw = localStorage.getItem(STORAGE_KEYS.zoom);
  return clamp(parseFloat(raw || '1'), 0.1, 8);
}

function updateBounds() {
  state.strokesBounds = computeBounds(state.strokes);
  emit('boundschange', state.strokesBounds);
}

function persistSwatches() {
  localStorage.setItem(STORAGE_KEYS.swatches, JSON.stringify(state.swatches));
}

function persistView() {
  localStorage.setItem(STORAGE_KEYS.zoom, String(state.zoom.toFixed(3)));
  localStorage.setItem(STORAGE_KEYS.pan, JSON.stringify({ x: state.pan.x, y: state.pan.y }));
}

function persistBrushSettings() {
  localStorage.setItem(STORAGE_KEYS.color, state.currentColor);
  localStorage.setItem(STORAGE_KEYS.brush, state.brush);
  localStorage.setItem(STORAGE_KEYS.size, String(state.size));
}

export async function loadInitialState() {
  state.zoom = loadViewZoom();
  state.pan = loadPan();
  state.navigatorVisible = loadNavigatorVisibility();
  state.currentColor = localStorage.getItem(STORAGE_KEYS.color) || DEFAULTS.currentColor;
  state.brush = localStorage.getItem(STORAGE_KEYS.brush) || DEFAULTS.brush;
  state.size = parseInt(localStorage.getItem(STORAGE_KEYS.size) || String(DEFAULTS.size), 10);
  if (!Number.isFinite(state.size) || state.size <= 0) {
    state.size = DEFAULTS.size;
  }
  state.swatches = loadSwatches();
  state.redoStack = [];

  const fromIndexedDB = await loadStrokesFromIndexedDB();
  if (Array.isArray(fromIndexedDB)) {
    state.strokes = fromIndexedDB;
  } else {
    try {
      state.strokes = JSON.parse(localStorage.getItem(STORAGE_KEYS.strokesBackup) || '[]');
    } catch (err) {
      state.strokes = [];
    }
  }

  updateBounds();
  emit('stateReady', null);
}

export function saveStrokes() {
  const snapshot = state.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((p) => ({ ...p })) }));
  localStorage.setItem(STORAGE_KEYS.strokesBackup, JSON.stringify(snapshot));
  saveStrokesToIndexedDB(snapshot);
}

export function setZoom(value) {
  state.zoom = clamp(value, 0.1, 8);
  persistView();
  emit('zoomchange', state.zoom);
}

export function setPan(nextPan) {
  state.pan = { x: nextPan.x, y: nextPan.y };
  persistView();
  emit('panchange', { ...state.pan });
}

export function setNavigatorVisible(visible) {
  state.navigatorVisible = Boolean(visible);
  localStorage.setItem(STORAGE_KEYS.navigator, state.navigatorVisible ? '1' : '0');
  emit('navigatorchange', state.navigatorVisible);
}

export function setCurrentColor(color) {
  state.currentColor = color;
  persistBrushSettings();
  emit('colorchange', color);
}

export function setBrush(brush) {
  state.brush = brush;
  persistBrushSettings();
  emit('brushchange', brush);
}

export function setSize(size) {
  const next = clamp(Number(size) || DEFAULTS.size, 1, 80);
  state.size = next;
  persistBrushSettings();
  emit('sizechange', next);
}

export function overwriteSwatches(next) {
  state.swatches = [...next];
  persistSwatches();
  emit('swatchchange', [...state.swatches]);
}

export function upsertSwatch(index, color) {
  state.swatches[index] = color;
  persistSwatches();
  emit('swatchchange', [...state.swatches]);
}

export function clearSwatches() {
  state.swatches = [];
  persistSwatches();
  emit('swatchchange', [...state.swatches]);
}

export function addStroke(stroke) {
  state.strokes.push(stroke);
  state.redoStack.length = 0;
  saveStrokes();
  updateBounds();
  emit('strokeschange', [...state.strokes]);
  emit('historychange', { canUndo: state.strokes.length > 0, canRedo: state.redoStack.length > 0 });
}

export function replaceStrokes(strokes) {
  state.strokes = strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((p) => ({ ...p })) }));
  state.redoStack.length = 0;
  saveStrokes();
  updateBounds();
  emit('strokeschange', [...state.strokes]);
  emit('historychange', { canUndo: state.strokes.length > 0, canRedo: false });
}

export function clearStrokes() {
  state.strokes = [];
  state.redoStack = [];
  saveStrokes();
  updateBounds();
  emit('strokeschange', []);
  emit('historychange', { canUndo: false, canRedo: false });
}

export function undo() {
  const stroke = state.strokes.pop();
  if (stroke) {
    state.redoStack.push(stroke);
    saveStrokes();
    updateBounds();
    emit('strokeschange', [...state.strokes]);
    emit('historychange', { canUndo: state.strokes.length > 0, canRedo: state.redoStack.length > 0 });
    return stroke;
  }
  return null;
}

export function redo() {
  const stroke = state.redoStack.pop();
  if (stroke) {
    state.strokes.push(stroke);
    saveStrokes();
    updateBounds();
    emit('strokeschange', [...state.strokes]);
    emit('historychange', { canUndo: state.strokes.length > 0, canRedo: state.redoStack.length > 0 });
    return stroke;
  }
  return null;
}

export function computeBounds(strokes) {
  if (!strokes || strokes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  strokes.forEach((stroke) => {
    stroke.points.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0
    };
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function on(type, callback) {
  const handler = (event) => callback(event.detail);
  emitter.addEventListener(type, handler);
  return () => emitter.removeEventListener(type, handler);
}

export function snapshotState() {
  return {
    zoom: state.zoom,
    pan: { ...state.pan },
    navigatorVisible: state.navigatorVisible,
    currentColor: state.currentColor,
    brush: state.brush,
    size: state.size,
    swatches: [...state.swatches],
    strokes: state.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((p) => ({ ...p })) })),
    redoStack: [...state.redoStack]
  };
}
