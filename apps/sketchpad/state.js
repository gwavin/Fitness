export const state = {
  strokes: [],
  redoStack: [],
  camera: { x: 0, y: 0, zoom: 1 },
  palette: [
    '#2d3436', // Black
    '#ff7675', // Coral
    '#fd79a8', // Pink
    '#6c5ce7', // Purple
    '#0984e3', // Blue
    '#00cec9', // Teal
    '#00b894', // Green
    '#fdcb6e', // Yellow
    '#e17055', // Orange
  ],
  settings: {
    tool: 'brush', // 'brush' | 'eraser'
    brushType: 'pencil', // 'pencil' | 'marker' | 'pen'
    color: '#2d3436',
    size: 5,
    smoothing: 0.5
  }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(event, data) {
  listeners.forEach(fn => fn(event, data));
}

// Actions
export function setTool(tool) {
  state.settings.tool = tool;
  notify('tool', tool);
}

export function setBrushType(type) {
  state.settings.brushType = type;
  state.settings.tool = 'brush'; // Auto-switch to brush
  notify('brush', type);
}

export function setColor(color) {
  state.settings.color = color;
  state.settings.tool = 'brush'; // Auto-switch to brush
  notify('color', color);
}

export function addColor(color) {
  if (!state.palette.includes(color)) {
    state.palette.push(color);
    notify('palette', state.palette);
  }
  setColor(color);
}

export function removeColor(color) {
  const index = state.palette.indexOf(color);
  if (index > -1 && state.palette.length > 1) {
    state.palette.splice(index, 1);
    // Select previous color or first
    const newColor = state.palette[Math.max(0, index - 1)];
    setColor(newColor);
    notify('palette', state.palette);
  }
}

export function setSize(size) {
  state.settings.size = size;
  notify('size', size);
}

export function addStroke(stroke) {
  state.strokes.push(stroke);
  state.redoStack = []; // Clear redo on new action
  notify('history', null);
  notify('draw', null);
}

export function undo() {
  if (state.strokes.length === 0) return;
  const stroke = state.strokes.pop();
  state.redoStack.push(stroke);
  notify('history', null);
  notify('draw', null);
}

export function redo() {
  if (state.redoStack.length === 0) return;
  const stroke = state.redoStack.pop();
  state.strokes.push(stroke);
  notify('history', null);
  notify('draw', null);
}

export function clearCanvas() {
  if (state.strokes.length === 0) return;
  state.strokes = [];
  state.redoStack = [];
  notify('history', null);
  notify('draw', null);
}

export function updateCamera(x, y, zoom) {
  state.camera.x = x;
  state.camera.y = y;
  state.camera.zoom = zoom;
  notify('camera', state.camera);
}
