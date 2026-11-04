import * as THREE from 'three';

export const WEAPONS = [
  {
    id: 'pistol', name: 'P-9 SIDEARM', short: 'P-9', slot: 1,
    damage: 26, pellets: 1, rpm: 360, mag: 12, reload: 1.05, spread: 0.006, moveSpread: 0.018,
    recoil: 0.018, kick: 0.9, sound: 'pistol', color: 0xffd16b, auto: false,
    range: 90, zoom: 1.15, viewPos: [0.31, -0.24, -1.0], viewRot: [0.02, 0.3, 0], scale: 0.7,
  },
  {
    id: 'shotgun', name: 'SPAS-12', short: 'SPAS', slot: 2,
    damage: 12, pellets: 8, rpm: 78, mag: 6, reload: 2.0, spread: 0.075, moveSpread: 0.045,
    recoil: 0.065, kick: 2.4, sound: 'shotgun', color: 0xff9e4a, auto: false,
    range: 38, zoom: 1.0, viewPos: [0.3, -0.25, -0.96], viewRot: [0.015, 0.3, 0], scale: 0.74,
  },
  {
    id: 'rifle', name: 'AK-47', short: 'AK', slot: 3,
    damage: 18, pellets: 1, rpm: 600, mag: 30, reload: 1.65, spread: 0.012, moveSpread: 0.03,
    recoil: 0.013, kick: 0.7, sound: 'rifle', color: 0x8efcff, auto: true,
    range: 100, zoom: 1.25, viewPos: [0.31, -0.24, -0.99], viewRot: [0.02, 0.3, 0], scale: 0.7,
  },
  {
    id: 'sniper', name: 'DRAGUNOV', short: 'DRAG', slot: 4,
    damage: 98, pellets: 1, rpm: 48, mag: 5, reload: 2.35, spread: 0.0018, moveSpread: 0.06,
    recoil: 0.08, kick: 3.2, sound: 'sniper', color: 0xffe66d, auto: false, scope: 5.5,
    range: 180, zoom: 1.0, viewPos: [0.3, -0.25, -0.97], viewRot: [0.015, 0.3, 0], scale: 0.74,
  },
  {
    id: 'rocket', name: 'RPG-7', short: 'RPG', slot: 5,
    damage: 145, pellets: 1, rpm: 42, mag: 1, reload: 2.65, spread: 0.012, moveSpread: 0.02,
    recoil: 0.07, kick: 3.4, sound: 'rocket', color: 0xff6c42, auto: false,
    projectile: 'rocket', projectileSpeed: 38, splash: 4.8, splashDamage: 95,
    range: 150, zoom: 1.0, viewPos: [0.3, -0.26, -0.92], viewRot: [0.015, 0.28, 0], scale: 0.74,
  },
  {
    id: 'plasma', name: 'RG6 PLASMA', short: 'RG6', slot: 6,
    damage: 24, pellets: 1, rpm: 430, mag: 42, reload: 1.8, spread: 0.014, moveSpread: 0.026,
    recoil: 0.021, kick: 1.1, sound: 'plasma', color: 0x68ffcb, auto: true,
    projectile: 'plasma', projectileSpeed: 62, splash: 0.9, splashDamage: 10,
    range: 110, zoom: 1.3, viewPos: [0.31, -0.24, -0.99], viewRot: [0.02, 0.3, 0], scale: 0.7,
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

const MAT = {
  dark: new THREE.MeshStandardMaterial({ color: 0x2c3948, metalness: 0.82, roughness: 0.3 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x4a5a6c, metalness: 0.72, roughness: 0.34 }),
  light: new THREE.MeshStandardMaterial({ color: 0x93a8bb, metalness: 0.88, roughness: 0.22 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x315e74, metalness: 0.5, roughness: 0.42 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x303945, metalness: 0.18, roughness: 0.82 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xe0b45a, metalness: 0.8, roughness: 0.24 }),
};

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
}

function makeHands(team) {
  const group = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: team === 'red' ? 0xd52f32 : 0x2574e8, metalness: 0.45, roughness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8fa4b8, metalness: 0.8, roughness: 0.25 });
  const left = new THREE.Group();
  const leftArm = box(0.12, 0.13, 0.36, armor, 0, 0, 0.06);
  leftArm.rotation.x = -0.25;
  left.add(leftArm);
  const leftHand = box(0.16, 0.09, 0.2, metal, 0, 0, -0.18);
  left.add(leftHand);
  for (let i = 0; i < 3; i++) {
    const finger = box(0.055, 0.07, 0.16, metal, -0.065 + i * 0.065, 0.04, -0.33);
    finger.rotation.x = 0.45;
    left.add(finger);
  }
  left.position.set(-0.15, -0.09, 0.36);
  group.add(left);
  const right = new THREE.Group();
  const rightArm = box(0.13, 0.14, 0.4, armor, 0, 0, 0.08);
  rightArm.rotation.x = 0.18;
  right.add(rightArm);
  const rightHand = box(0.17, 0.14, 0.18, metal, 0, 0, -0.11);
  right.add(rightHand);
  for (let i = 0; i < 3; i++) {
    const finger = box(0.05, 0.09, 0.15, metal, -0.06 + i * 0.06, 0.05, -0.23);
    finger.rotation.x = 0.65;
    right.add(finger);
  }
  right.position.set(0.14, -0.115, 0.23);
  group.add(right);
  return group;
}

function buildPistol() {
  const group = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color: 0xffcf68, emissive: 0xffaf2e, emissiveIntensity: 2, metalness: 0.2, roughness: 0.25 });
  group.add(box(0.15, 0.16, 0.52, MAT.gun, 0, 0, -0.3));
  group.add(box(0.17, 0.055, 0.56, MAT.light, 0, 0.09, -0.31));
  group.add(cyl(0.034, 0.034, 0.2, 10, MAT.dark, 0, 0.02, -0.62));
  group.add(box(0.14, 0.19, 0.18, MAT.grip, 0, -0.16, -0.02));
  group.children[group.children.length - 1].rotation.x = -0.18;
  group.add(box(0.08, 0.05, 0.36, glow, 0, -0.075, -0.28));
  const slide = box(0.16, 0.05, 0.22, MAT.dark, 0, 0.125, -0.25);
  group.add(slide);
  group.add(box(0.03, 0.05, 0.03, glow, 0, 0.158, -0.54));
  group.add(box(0.03, 0.05, 0.03, glow, 0, 0.158, -0.45));
  return { group, muzzle: new THREE.Vector3(0, 0.02, -0.75), slide, trigger: -1 };
}

function buildShotgun() {
  const group = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color: 0xff8a42, emissive: 0xff5f17, emissiveIntensity: 1.8, metalness: 0.2, roughness: 0.3 });
  group.add(box(0.18, 0.2, 0.85, MAT.gun, 0, 0, -0.21));
  group.add(cyl(0.05, 0.05, 0.92, 12, MAT.dark, 0, 0.055, -0.62));
  group.add(cyl(0.045, 0.045, 0.8, 12, MAT.dark, 0, -0.02, -0.56));
  const pump = new THREE.Group();
  pump.add(box(0.2, 0.14, 0.32, MAT.grip, 0, 0, 0));
  for (let i = 0; i < 4; i++) pump.add(box(0.21, 0.025, 0.035, MAT.light, 0, 0.06, -0.12 + i * 0.08));
  pump.position.set(0, -0.03, -0.55);
  group.add(pump);
  const stock = box(0.16, 0.22, 0.4, MAT.accent, 0, -0.04, 0.38);
  stock.rotation.x = -0.1;
  group.add(stock);
  group.add(box(0.16, 0.2, 0.18, MAT.grip, 0, -0.16, 0.06));
  group.add(box(0.06, 0.05, 0.4, glow, 0, -0.115, -0.18));
  group.add(box(0.06, 0.04, 0.07, glow, 0, 0.13, 0.0));
  group.add(box(0.035, 0.07, 0.04, MAT.light, 0, 0.15, -0.6));
  return { group, muzzle: new THREE.Vector3(0, 0.04, -1.1), pump, trigger: -1 };
}

function buildRifle() {
  const group = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color: 0x8af7ff, emissive: 0x23d9ff, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.2 });
  group.add(box(0.18, 0.2, 0.68, MAT.gun, 0, 0, -0.26));
  group.add(box(0.16, 0.12, 0.35, MAT.accent, 0, 0.02, 0.2));
  group.add(cyl(0.04, 0.04, 0.7, 10, MAT.dark, 0, 0.05, -0.72));
  group.add(box(0.095, 0.07, 0.4, MAT.light, 0, 0.13, -0.34));
  const mag = box(0.11, 0.3, 0.22, MAT.grip, 0, -0.18, -0.12);
  mag.rotation.x = 0.22;
  group.add(mag);
  const grip = box(0.12, 0.23, 0.16, MAT.grip, 0, -0.18, 0.16);
  grip.rotation.x = 0.2;
  group.add(grip);
  group.add(box(0.07, 0.04, 0.25, glow, 0.085, 0.0, -0.27));
  group.add(box(0.04, 0.06, 0.04, MAT.light, 0, 0.17, -0.76));
  group.add(box(0.12, 0.04, 0.6, MAT.accent, 0, 0.08, 0.36));
  return { group, muzzle: new THREE.Vector3(0, 0.045, -1.08), mag, trigger: -1 };
}

function buildSniper() {
  const group = new THREE.Group();
  const lens = new THREE.MeshStandardMaterial({ color: 0xffd960, emissive: 0xffb300, emissiveIntensity: 2.2, metalness: 0.1, roughness: 0.2 });
  group.add(box(0.16, 0.18, 0.85, MAT.accent, 0, 0, -0.24));
  group.add(cyl(0.028, 0.035, 1.05, 10, MAT.dark, 0, 0.03, -0.83));
  group.add(box(0.18, 0.17, 0.37, MAT.grip, 0, -0.02, 0.38));
  const cheek = box(0.16, 0.08, 0.42, MAT.grip, 0, 0.12, 0.36);
  cheek.rotation.x = -0.04;
  group.add(cheek);
  group.add(box(0.12, 0.21, 0.16, MAT.grip, 0, -0.17, 0.12));
  const scope = new THREE.Group();
  scope.add(cyl(0.095, 0.095, 0.45, 12, MAT.dark, 0, 0, 0));
  scope.add(cyl(0.11, 0.11, 0.08, 12, MAT.light, 0, 0, -0.2));
  scope.add(cyl(0.1, 0.1, 0.08, 12, MAT.light, 0, 0, 0.2));
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), lens);
  glass.position.z = -0.25;
  scope.add(glass);
  scope.position.set(0, 0.21, -0.17);
  group.add(scope);
  const bolt = box(0.06, 0.05, 0.22, MAT.light, 0.11, 0.05, -0.08);
  group.add(bolt);
  group.add(box(0.055, 0.07, 0.2, lens, -0.07, 0.14, -0.6));
  group.add(box(0.04, 0.08, 0.04, MAT.light, 0, 0.21, -0.86));
  return { group, muzzle: new THREE.Vector3(0, 0.03, -1.36), bolt, trigger: -1 };
}

function buildRocket() {
  const group = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color: 0xff6b3d, emissive: 0xff3d0a, emissiveIntensity: 2.4, metalness: 0.2, roughness: 0.28 });
  group.add(cyl(0.11, 0.13, 0.92, 14, MAT.accent, 0, 0.02, -0.36));
  const tube = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), MAT.light);
  tube.position.set(0, 0.02, 0.12);
  group.add(tube);
  const tube2 = tube.clone();
  tube2.position.z = -0.85;
  group.add(tube2);
  const rocket = new THREE.Group();
  rocket.add(cyl(0.06, 0.11, 0.6, 8, MAT.gun, 0, 0, 0));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 8), glow);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.4;
  rocket.add(tip);
  rocket.position.set(0, 0.02, -0.94);
  group.add(rocket);
  group.add(box(0.1, 0.3, 0.14, MAT.grip, 0, -0.2, 0.0));
  group.add(box(0.08, 0.06, 0.32, MAT.dark, 0.13, 0.16, -0.3));
  group.add(box(0.14, 0.12, 0.18, MAT.grip, 0, -0.02, 0.38));
  group.add(box(0.06, 0.05, 0.2, glow, -0.08, -0.07, -0.2));
  return { group, muzzle: new THREE.Vector3(0, 0.02, -1.26), rocket, trigger: -1 };
}

function buildPlasma() {
  const group = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color: 0x59ffc0, emissive: 0x16ff98, emissiveIntensity: 3.0, metalness: 0.1, roughness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x132c31, metalness: 0.8, roughness: 0.22 });
  group.add(box(0.2, 0.22, 0.75, dark, 0, 0, -0.28));
  group.add(box(0.16, 0.14, 0.4, MAT.accent, 0, 0, 0.18));
  const coil = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.105 - i * 0.008, 0.022, 6, 16), glow);
    ring.position.z = -0.62 - i * 0.1;
    coil.add(ring);
  }
  group.add(coil);
  group.add(cyl(0.045, 0.045, 0.5, 10, MAT.light, 0, 0.02, -0.86));
  group.add(box(0.15, 0.3, 0.18, MAT.grip, 0, -0.2, 0.0));
  group.add(box(0.08, 0.24, 0.14, MAT.grip, 0, -0.17, 0.27));
  const cell = box(0.13, 0.16, 0.2, glow, 0, 0.16, 0.05);
  group.add(cell);
  group.add(box(0.075, 0.035, 0.5, glow, 0.1, 0.0, -0.35));
  return { group, muzzle: new THREE.Vector3(0, 0.02, -1.14), coil, trigger: -1 };
}

const BUILDERS = {
  pistol: buildPistol,
  shotgun: buildShotgun,
  rifle: buildRifle,
  sniper: buildSniper,
  rocket: buildRocket,
  plasma: buildPlasma,
};

export function buildViewModel(config, team = 'blue') {
  const built = BUILDERS[config.id]();
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(built.group);
  const hands = makeHands(team);
  // Floating cartoon hardware reads better than giant block-mitten hands at
  // this camera distance, so the hand rig stays out of the first-person view.
  hands.visible = false;
  inner.scale.setScalar(config.scale || 1);
  group.add(inner);
  group.position.set(...config.viewPos);
  group.rotation.set(...config.viewRot);
  const muzzleLocal = built.muzzle.clone().multiplyScalar(config.scale || 1);
  const muzzle = new THREE.Object3D();
  muzzle.position.copy(muzzleLocal);
  inner.add(muzzle);
  // Little weapon light.
  const light = new THREE.PointLight(config.color, 0.45, 1.4, 2);
  light.position.copy(muzzleLocal).add(new THREE.Vector3(0, 0, 0.08));
  inner.add(light);
  return { group, inner, built, muzzle, light, config, hands, basePos: new THREE.Vector3(...config.viewPos) };
}

export function createViewScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
  const hemi = new THREE.HemisphereLight(0xa9eaff, 0x18212b, 1.5);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xbcd8e8, 0.42);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-1.5, 3, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x69d9ff, 0.75);
  fill.position.set(2, 1, 1.5);
  scene.add(fill);
  const rim = new THREE.PointLight(0x3de8ff, 2.4, 5);
  rim.position.set(1.5, 0.2, -0.5);
  scene.add(rim);
  const warm = new THREE.PointLight(0xff9c5c, 1.4, 4);
  warm.position.set(-1.2, -0.1, 0.6);
  scene.add(warm);
  return { scene, camera, lights: { hemi, ambient, key, fill, rim, warm } };
}
