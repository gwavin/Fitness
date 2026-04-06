import { parseRoute } from './utils.js';
import { renderRoute } from './ui.js';

export function initRouter() {
  const run = () => {
    const route = parseRoute();
    renderRoute(route);
    document.querySelectorAll('[data-nav-link]').forEach(link => {
      const target = link.getAttribute('href').replace('#/', '');
      const active = route.resource === target || route.raw.startsWith(`${target}/`);
      link.classList.toggle('active', active);
    });
  };

  window.addEventListener('hashchange', run);
  run();
}
