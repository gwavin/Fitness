import { loadState } from './store.js';
import { initRouter } from './router.js';

function initShell() {
  const menuBtn = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  menuBtn?.addEventListener('click', () => sidebar.classList.toggle('open'));
}

function init() {
  loadState();
  initShell();
  initRouter();
}

window.addEventListener('DOMContentLoaded', init);
