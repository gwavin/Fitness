import { state, addStroke, updateCamera } from './state.js';
import { getPointerPos, distance, midpoint, clamp } from './utils.js';

export class CanvasEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.dpr = window.devicePixelRatio || 1;
    this.backgroundImage = null;

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
    this.requestRender();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    this.ctx.scale(this.dpr, this.dpr);
    this.updateBackgroundFit();
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

  handlePointerDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.activePointers.set(e.pointerId, e);

    if (this.activePointers.size === 2) {
      // Start Pinch/Pan
      this.isDrawing = false;
      this.currentStroke = null;

      const points = Array.from(this.activePointers.values()).map(p => getPointerPos(p, this.canvas));
      this.pinchStart = {
        dist: distance(points[0], points[1]),
        mid: midpoint(points[0], points[1]),
        zoom: state.camera.zoom,
        cam: { ...state.camera }
      };
      return;
    }

    if (this.activePointers.size === 1) {
      const pos = getPointerPos(e, this.canvas);

      // Spacebar or Middle Mouse for Panning
      if (e.button === 1 || (e.button === 0 && e.getModifierState && e.getModifierState('Space'))) {
         this.isPanning = true;
         this.lastPanPos = pos;
         return;
      }

      // Start Drawing
      this.isDrawing = true;
      const worldPos = this.toWorld(pos.x, pos.y);

      const { settings } = state;
      this.currentStroke = {
        points: [{ ...worldPos, pressure: pos.pressure }],
        color: settings.color,
        size: settings.size,
        type: settings.brushType,
        isEraser: settings.tool === 'eraser'
      };

      this.requestRender();
    }
  }

  handlePointerMove(e) {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, e);

    if (this.activePointers.size === 2 && this.pinchStart) {
      const points = Array.from(this.activePointers.values()).map(p => getPointerPos(p, this.canvas));
      const newDist = distance(points[0], points[1]);
      const newMid = midpoint(points[0], points[1]);

      const scale = newDist / this.pinchStart.dist;
      const targetZoom = clamp(this.pinchStart.zoom * scale, 0.1, 5);

      // Calculate Pan to keep midpoint stable
      // World point at start
      const wx = (this.pinchStart.mid.x - this.pinchStart.cam.x) / this.pinchStart.zoom;
      const wy = (this.pinchStart.mid.y - this.pinchStart.cam.y) / this.pinchStart.zoom;

      // New Camera pos
      const newCamX = newMid.x - wx * targetZoom;
      const newCamY = newMid.y - wy * targetZoom;

      updateCamera(newCamX, newCamY, targetZoom);
      this.requestRender();
      return;
    }

    const pos = getPointerPos(e, this.canvas);

    if (this.isPanning) {
        const dx = pos.x - this.lastPanPos.x;
        const dy = pos.y - this.lastPanPos.y;
        updateCamera(state.camera.x + dx, state.camera.y + dy, state.camera.zoom);
        this.lastPanPos = pos;
        this.requestRender();
        return;
    }

    if (this.isDrawing && this.currentStroke) {
        // Get coalesced events if available for smoother curves
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

        events.forEach(evt => {
            const p = getPointerPos(evt, this.canvas);
            const worldPos = this.toWorld(p.x, p.y);
            this.currentStroke.points.push({ ...worldPos, pressure: p.pressure });
        });

        this.requestRender();
    }
  }

  handlePointerUp(e) {
    this.activePointers.delete(e.pointerId);
    this.canvas.releasePointerCapture(e.pointerId);

    if (this.activePointers.size < 2) {
      this.pinchStart = null;
    }

    this.isPanning = false;

    if (this.isDrawing) {
      this.isDrawing = false;
      if (this.currentStroke) {
        addStroke(this.currentStroke);
        this.currentStroke = null;
      }
    }
    this.requestRender();
  }

  handleWheel(e) {
    e.preventDefault();

    if (e.ctrlKey) {
      // Zoom
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const zoomFactor = 1 + delta;

      const currentZoom = state.camera.zoom;
      const newZoom = clamp(currentZoom * zoomFactor, 0.1, 5);

      // Zoom towards pointer
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const wx = (mx - state.camera.x) / currentZoom;
      const wy = (my - state.camera.y) / currentZoom;

      const newCamX = mx - wx * newZoom;
      const newCamY = my - wy * newZoom;

      updateCamera(newCamX, newCamY, newZoom);
    } else {
      // Pan
      updateCamera(state.camera.x - e.deltaX, state.camera.y - e.deltaY, state.camera.zoom);
    }
    this.requestRender();
  }

  requestRender() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(() => {
      // Clear
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Transform
      this.ctx.save();
      const { x, y, zoom } = state.camera;
      this.ctx.translate(x, y);
      this.ctx.scale(zoom, zoom);

      // Strokes
      if (this.backgroundImage?.img) {
        this.ctx.drawImage(
          this.backgroundImage.img,
          this.backgroundImage.offsetX,
          this.backgroundImage.offsetY,
          this.backgroundImage.drawWidth,
          this.backgroundImage.drawHeight
        );
      }

      state.strokes.forEach(stroke => this.drawStroke(this.ctx, stroke));

      // Current Stroke
      if (this.currentStroke) {
        this.drawStroke(this.ctx, this.currentStroke);
      }

      this.ctx.restore();
    });
  }

  setBackgroundImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.backgroundImage = {
        img,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        drawWidth: img.naturalWidth,
        drawHeight: img.naturalHeight,
        offsetX: 0,
        offsetY: 0
      };
      this.updateBackgroundFit();
      this.requestRender();
    };
    img.src = dataUrl;
  }

  updateBackgroundFit() {
    if (!this.backgroundImage?.img) return;

    const { naturalWidth, naturalHeight } = this.backgroundImage;
    const scale = Math.min(this.width / naturalWidth, this.height / naturalHeight, 1);

    const drawWidth = naturalWidth * scale;
    const drawHeight = naturalHeight * scale;

    this.backgroundImage.drawWidth = drawWidth;
    this.backgroundImage.drawHeight = drawHeight;
    this.backgroundImage.offsetX = 0;
    this.backgroundImage.offsetY = 0;
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
  }

  drawStroke(ctx, stroke) {
    if (stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Brush Styles
    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#f0f2f5';
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
