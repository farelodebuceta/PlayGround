import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { AudioSystem } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';

const stage = document.getElementById('stage');

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false,
  alpha: false,
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'game-canvas';
renderer.domElement.setAttribute('aria-label', 'We Are The Robots arena');
stage.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1828);
scene.fog = new THREE.FogExp2(0x19364d, 0.0075);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.05, 420);
camera.position.set(3.6, 7.2, 13.5);
camera.rotation.order = 'YXZ';

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.62,
  0.58,
  0.78,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Systems
// ---------------------------------------------------------------------------
const audio = new AudioSystem();
const ui = new UI(audio);
const game = new Game({ renderer, scene, camera, composer, ui, audio });

// A small studio environment gives the first-person hardware readable metal
// highlights without requiring any texture downloads.
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  game.view.scene.environment = pmrem.fromScene(room, 0.04).texture;
  game.view.scene.environmentIntensity = 0.35;
  room.dispose?.();
  pmrem.dispose();
} catch (err) {
  console.warn('Viewmodel environment unavailable:', err);
}

ui.onDeploy = (team) => game.start(team);
ui.onResume = () => game.resumeGame();
ui.onQuit = () => game.quitToMenu();
ui.onRetry = () => game.retry();
ui.onMenu = () => game.quitToMenu();
ui.onInteract = () => game.tryPortal();
ui.onPause = () => game.pauseGame();

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  game.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 160));
resize();

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------
const bootLines = [
  [0.06, 'INITIALIZING OPTICS...'],
  [0.24, 'MOUNTING WEAPON HARDWARE...'],
  [0.44, 'CALIBRATING CITYSCAPE...'],
  [0.62, 'SYNCING COMBAT NETWORK...'],
  [0.78, 'LOADING VENUS TELEMETRY...'],
  [0.92, 'WAKING THE ROBOTS...'],
];

let bootProgress = 0;
let bootDone = false;
let bootSkipped = false;

function enterMenu() {
  if (bootDone) return;
  bootDone = true;
  ui.setBootProgress(1, 'SYSTEMS NOMINAL');
  ui.hideBoot();
  ui.showMenu();
  try {
    ui.setBootProgress(1, 'SYSTEMS NOMINAL');
  } catch {}
  window.setTimeout(() => {
    if (game.state === 'menu') ui.systemChat?.('Cityscape relay online. Pick a chassis.');
  }, 900);
}

function updateBoot(dt) {
  if (bootDone) return;
  bootProgress = Math.min(1, bootProgress + dt * 0.66);
  ui.setBootProgress(bootProgress);
  for (const [threshold, label] of bootLines) {
    if (bootProgress >= threshold) ui.setBootProgress(bootProgress, label);
  }
  if (bootProgress >= 1) enterMenu();
}

function skipBoot() {
  if (bootDone || bootSkipped) return;
  bootSkipped = true;
  bootProgress = Math.max(bootProgress, 0.98);
  enterMenu();
}
window.addEventListener('keydown', skipBoot, { once: true });
window.addEventListener('pointerdown', skipBoot, { once: true });

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let firstFrame = true;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  updateBoot(dt);
  game.update(dt);
  game.render();
  if (firstFrame) {
    firstFrame = false;
    document.body.classList.add('ready');
  }
}
requestAnimationFrame(frame);

// Pause when the tab loses focus so nobody comes back to a dead chassis.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') game.pauseGame();
});

window.__WATR__ = { game, ui, audio, renderer, scene, camera, composer };
