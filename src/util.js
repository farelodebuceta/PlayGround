export const TAU = Math.PI * 2;

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export function dampAngle(a, b, lambda, dt) {
  return a - angleDelta(a, b) * (1 - Math.exp(-lambda * dt));
}

export function pad(num, size = 2) {
  return String(Math.max(0, Math.floor(num))).padStart(size, '0');
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(m)}:${pad(s)}`;
}

export function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A tiny deterministic random source so the city looks designed, not noisy.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Imported late to avoid a circular-looking import in every utility consumer.
import * as THREE from 'three';

export function createTextTexture(text, {
  width = 512, height = 128, fg = '#f7fbff', bg = 'rgba(0,0,0,0)',
  font = '900 74px Arial Black, Arial, sans-serif', glow = '#35efff', stroke = null,
} = {}) {
  return makeCanvasTexture(width, height, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (bg !== 'rgba(0,0,0,0)') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
    }
    if (stroke) {
      ctx.lineWidth = 10;
      ctx.strokeStyle = stroke;
      ctx.strokeText(text, w / 2, h / 2 + 2);
    }
    ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

export function createGlowTexture(color = '#4df6ff') {
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.15, `rgba(${rgb},1)`);
    g.addColorStop(0.5, `rgba(${rgb},0.3)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
