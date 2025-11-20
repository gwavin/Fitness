export function getPointerPos(e, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    pressure: e.pressure !== undefined ? e.pressure : 0.5
  };
}

export function distance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function midpoint(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

// Catmull-Rom spline interpolation for smoother curves if needed
// But Quadratic Bezier is usually enough for drawing
export function getSvgPathFromStroke(stroke) {
  if (stroke.points.length === 0) return '';
  const d = [`M ${stroke.points[0].x} ${stroke.points[0].y}`];
  for (let i = 1; i < stroke.points.length; i++) {
    d.push(`L ${stroke.points[i].x} ${stroke.points[i].y}`);
  }
  return d.join(' ');
}
