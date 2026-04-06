import { getSeedData } from './seed.js';

const STORAGE_KEY = 'rental_mgmt_prototype_v1';

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function loadState() {
  const data = safeParse(localStorage.getItem(STORAGE_KEY));
  if (data) return data;
  const seeded = getSeedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  const seeded = getSeedData();
  saveState(seeded);
  return seeded;
}

export function withState(mutator) {
  const state = loadState();
  const result = mutator(state) || state;
  saveState(result);
  return result;
}

export function getStorageKey() {
  return STORAGE_KEY;
}
