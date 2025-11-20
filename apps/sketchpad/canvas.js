import { state, addStroke, updateCamera } from './state.js';
import { getPointerPos, distance, midpoint, clamp } from './utils.js';

export class CanvasEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = window.devicePixelRatio || 1;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Interaction State
    this.isDrawing = false;
    this.isPanning = false;
    this.activePointers = new Map();
    this.currentStroke = null;

    // Pinch State
    this.pinchStart = null; // { dist, zoom, center, pan }

    this.setupEvents();
    this.render();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    this.ctx.scale(this.dpr, this.dpr);
    this.requestRender();
  }

  setupEvents() {
    const c = this.canvas;

    // Pointer Events (Mouse, Touch, Pen)
    c.addEventListener('pointerdown', this.handlePointerDown.bind(this), { passive: false });
    window.addEventListener('pointermove', this.handlePointerMove.bind(this), { passive: false });
    window.addEventListener('pointerup', this.handlePointerUp.bind(this));
    window.addEventListener('pointercancel', this.handlePointerUp.bind(this));

    // Wheel (Zoom/Pan)
    c.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

    // Prevent default touch actions
    c.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  }

  // --- Coordinate Systems ---

  // Screen (Pixels) -> World (Infinite Canvas)
  toWorld(x, y) {
    const { x: cx, y: cy, zoom } = state.camera;
    return {
      x: (x - cx) / zoom,
      y: (y - cy) / zoom
    };
  }

  // World -> Screen
  toScreen(x, y) {
    const { x: cx, y: cy, zoom } = state.camera;
    return {
      x: x * zoom + cx,
      y: y * zoom + cy
    };
    // Draw Current Stroke
    if (this.currentStroke) {
      this.drawStroke(ctx, this.currentStroke);
    }
  }

  drawGrid(ctx) {
    const { x, y, zoom } = state.camera;
    const gridSize = 20 * zoom;
    const offsetX = x % gridSize;
    const offsetY = y % gridSize;

    ctx.beginPath();
    ctx.strokeStyle = '#dfe6e9';
    ctx.lineWidth = 1;

    // Only draw if grid isn't too dense
    if (gridSize > 10) {
      // Vertical lines
      for (let i = offsetX; i < this.width; i += gridSize) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, this.height);
      }
      // Horizontal lines
      for (let j = offsetY; j < this.height; j += gridSize) {
        ctx.moveTo(0, j);
        ctx.lineTo(this.width, j);
      }
      ctx.stroke();
    }
  }

  drawStroke(ctx, stroke) {
    if (stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Brush Styles
    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out'; // This is tricky on a layered canvas, but here we just draw background color
      ctx.strokeStyle = '#f0f2f5'; // Hack for single layer canvas
      ctx.lineWidth = stroke.size * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;

      if (stroke.type === 'marker') {
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = stroke.size * 1.5;
      } else if (stroke.type === 'pen') {
        ctx.globalAlpha = 1;
        ctx.lineWidth = stroke.size * 0.5;
      } else {
        // Pencil
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = stroke.size;
      }
    }

    // Draw Curve
    // Using quadratic bezier for smoothness
    let p1 = stroke.points[0];
    let p2 = stroke.points[1];

    ctx.moveTo(p1.x, p1.y);

    for (let i = 1; i < stroke.points.length; i++) {
      const midPoint = midpoint(p1, p2);
      ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
      p1 = stroke.points[i];
      p2 = stroke.points[i + 1];
    }
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    // Reset
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  getImageData() {
    return this.canvas.toDataURL('image/png');
  }
}
