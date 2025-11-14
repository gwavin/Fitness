export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const distance = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function debounce(fn, delay = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export function createToastManager(element) {
  let hideTimer = null;
  function hide() {
    if (!element) return;
    element.classList.remove('show');
    hideTimer = null;
  }
  return {
    show(message, options = {}) {
      if (!element) return;
      element.textContent = message;
      element.classList.remove('error');
      if (options.variant === 'error') {
        element.classList.add('error');
      }
      element.classList.add('show');
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, options.duration ?? 2500);
    }
  };
}

export const cloneStroke = (stroke) => ({
  ...stroke,
  points: stroke.points.map((p) => ({ ...p }))
});

export function waitForFileRead(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsText(file, 'utf-8');
  });
}

export function createHiDPICanvas(width, height, dpr) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  return canvas;
}
