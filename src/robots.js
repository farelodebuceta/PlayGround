import * as THREE from 'three';
import { rand, TAU } from './util.js';

const TEAM_PALETTES = {
  blue: {
    armor: 0x2478ff, armorDark: 0x0c2b57, trim: 0xdcecff, glow: 0x58f6ff,
    metal: 0x788ba3, dark: 0x101b2c, eye: 0xa9feff,
  },
  red: {
    armor: 0xff3f3c, armorDark: 0x58151b, trim: 0xffd9bb, glow: 0xffa83d,
    metal: 0x917f7a, dark: 0x2a1115, eye: 0xffd27a,
  },
  boss: {
    armor: 0xffb02e, armorDark: 0x4d1b0b, trim: 0xfff1c7, glow: 0xff5c25,
    metal: 0xa58a64, dark: 0x2b0e0b, eye: 0xff3b22,
  },
  venus: {
    armor: 0x9237ff, armorDark: 0x280c47, trim: 0xf2d6ff, glow: 0xff5bd6,
    metal: 0x8b6fa8, dark: 0x180a27, eye: 0xff80ef,
  },
};

function mat(color, { metalness = 0.42, roughness = 0.4, emissive = 0x000000, emissiveIntensity = 1, flat = true } = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity, flatShading: flat });
}

function box(w, h, d, material, x = 0, y = 0, z = 0, bevel = false) {
  const geom = bevel
    ? new THREE.BoxGeometry(w, h, d, 2, 2, 2)
    : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function capsule(radius, length, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addEyes(head, palette, shape = 'visor') {
  const eyeMat = new THREE.MeshStandardMaterial({
    color: palette.eye, emissive: palette.eye, emissiveIntensity: 3.8, metalness: 0.1, roughness: 0.2,
  });
  if (shape === 'visor') {
    const visor = box(0.44, 0.12, 0.04, eyeMat, 0, 0.02, 0.305, false);
    head.add(visor);
    const brow = box(0.5, 0.055, 0.055, mat(palette.dark, { metalness: 0.6 }), 0, 0.12, 0.31);
    head.add(brow);
  } else {
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeMat);
      eye.position.set(side * 0.14, 0.03, 0.31);
      eye.scale.z = 0.55;
      head.add(eye);
    }
  }
  return eyeMat;
}

export function createRobotModel({ team = 'blue', variant = 'trooper', scale = 1, name = '' } = {}) {
  const palette = TEAM_PALETTES[team] || TEAM_PALETTES.blue;
  const root = new THREE.Group();
  root.name = `robot-${name || team}`;
  const body = new THREE.Group();
  root.add(body);

  const armor = mat(palette.armor, { metalness: 0.48, roughness: 0.34 });
  const armorDark = mat(palette.armorDark, { metalness: 0.62, roughness: 0.42 });
  const trim = mat(palette.trim, { metalness: 0.32, roughness: 0.5 });
  const metal = mat(palette.metal, { metalness: 0.82, roughness: 0.28 });
  const dark = mat(palette.dark, { metalness: 0.7, roughness: 0.32 });
  const glow = mat(palette.glow, { emissive: palette.glow, emissiveIntensity: 2.8, metalness: 0.1, roughness: 0.2 });
  const materials = [armor, armorDark, trim, metal, dark, glow];

  const heavy = variant === 'heavy';
  const scout = variant === 'scout';
  const sniper = variant === 'sniper';
  const boss = variant === 'boss';

  const w = boss ? 1.35 : heavy ? 1.2 : scout ? 0.82 : 0.96;
  const bodyH = boss ? 1.05 : heavy ? 0.9 : scout ? 0.64 : 0.76;
  const hipY = boss ? 1.1 : heavy ? 0.98 : 0.88;

  // Feet & legs, grouped for animation.
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * w * 0.23, hipY, 0);
    const thigh = capsule(0.13 * (heavy ? 1.45 : 1), 0.4 * (heavy ? 1.12 : 1), armorDark, 0, -0.25, 0);
    leg.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.15 * (heavy ? 1.3 : 1), 8, 6), metal);
    knee.position.y = -0.5;
    knee.castShadow = true;
    leg.add(knee);
    const shin = box(0.22 * (heavy ? 1.25 : 1), 0.45, 0.24, armor, 0, -0.7, 0);
    leg.add(shin);
    const boot = box(0.27 * (heavy ? 1.2 : 1), 0.18, 0.42, armorDark, 0, -0.94, 0.08);
    leg.add(boot);
    const toe = box(0.25, 0.1, 0.14, glow, 0, -0.91, 0.3);
    leg.add(toe);
    body.add(leg);
    legs.push(leg);
  }

  // Hips and torso.
  const hips = box(w * 0.78, 0.3, 0.46, metal, 0, hipY + 0.02, 0);
  body.add(hips);
  const abdomen = box(w * 0.58, 0.28, 0.4, armorDark, 0, hipY + 0.26, 0);
  body.add(abdomen);
  const torso = box(w, bodyH, 0.62 + (heavy ? 0.16 : 0), armor, 0, hipY + 0.36 + bodyH / 2, 0);
  torso.userData.zone = 'body';
  body.add(torso);

  // Chest armour, core and vents.
  const chestPlate = box(w * 0.84, bodyH * 0.55, 0.12, trim, 0, hipY + 0.43 + bodyH * 0.38, 0.35);
  chestPlate.userData.zone = 'body';
  body.add(chestPlate);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16), glow);
  core.rotation.x = Math.PI / 2;
  core.position.set(0, hipY + 0.52 + bodyH * 0.31, 0.42);
  body.add(core);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 18), metal);
  coreRing.position.copy(core.position);
  body.add(coreRing);

  for (const side of [-1, 1]) {
    const vent = box(0.09, bodyH * 0.25, 0.06, dark, side * w * 0.39, hipY + 0.38 + bodyH * 0.77, 0.31);
    body.add(vent);
    const stripe = box(0.035, bodyH * 0.22, 0.05, glow, side * w * 0.39, hipY + 0.38 + bodyH * 0.77, 0.345);
    body.add(stripe);
  }

  // Backpack / power pack.
  const pack = box(w * 0.72, bodyH * 0.85, 0.26, armorDark, 0, hipY + 0.48 + bodyH * 0.4, -0.42);
  body.add(pack);
  for (const side of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, bodyH * 0.6, 10), metal);
    tank.position.set(side * w * 0.25, hipY + 0.48 + bodyH * 0.4, -0.57);
    tank.castShadow = true;
    body.add(tank);
  }
  if (boss) {
    for (const side of [-1, 1]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 5), glow);
      spike.position.set(side * w * 0.32, hipY + 0.45 + bodyH * 1.02, -0.45);
      spike.rotation.z = side * 0.3;
      body.add(spike);
    }
  }

  // Head.
  const head = new THREE.Group();
  const headY = hipY + 0.47 + bodyH + (boss ? 0.3 : 0.18);
  head.position.set(0, headY, 0);
  body.add(head);
  const headSize = boss ? 0.82 : heavy ? 0.68 : scout ? 0.58 : 0.64;
  let headMesh;
  if (team === 'red' || boss) {
    headMesh = box(headSize, headSize * 0.84, headSize * 0.82, armor, 0, 0, 0.02, true);
    const jaw = box(headSize * 0.72, 0.16, headSize * 0.66, dark, 0, -headSize * 0.38, 0.08);
    head.add(jaw);
    addEyes(head, palette, 'visor');
  } else {
    headMesh = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.5, 12, 9), armor);
    headMesh.scale.set(1, 0.9, 0.95);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    head.add(headMesh);
    const face = box(headSize * 0.72, headSize * 0.55, 0.1, dark, 0, -0.015, headSize * 0.4);
    head.add(face);
    addEyes(head, palette, 'eyes');
  }
  headMesh.userData.zone = 'head';
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.38, 5), metal);
  antenna.position.set(headSize * 0.26, headSize * 0.56, -0.02);
  antenna.rotation.z = -0.22;
  head.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glow);
  antennaTip.position.set(headSize * 0.31, headSize * 0.74, -0.02);
  head.add(antennaTip);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 10), metal);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(side * headSize * 0.52, 0, 0);
    head.add(ear);
  }
  if (sniper) {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.32, 10), dark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0.12, headSize * 0.42, 0.16);
    head.add(scope);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 12), glow);
    lens.position.set(0.12, headSize * 0.42, 0.325);
    head.add(lens);
  }

  // Arms.
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * w * 0.62, hipY + 0.38 + bodyH * 0.8, 0);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(boss ? 0.31 : heavy ? 0.28 : 0.22, 10, 8), armorDark);
    shoulder.castShadow = true;
    arm.add(shoulder);
    const shoulderPad = box(w * 0.33, 0.22, 0.46, armor, side * 0.07, 0.12, 0);
    arm.add(shoulderPad);
    const upper = capsule(0.1 * (heavy ? 1.3 : 1), 0.38, dark, 0, -0.3, 0);
    arm.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), metal);
    elbow.position.y = -0.54;
    arm.add(elbow);
    const forearm = box(0.21, 0.38, 0.21, armor, 0, -0.76, 0);
    arm.add(forearm);
    const hand = box(0.18, 0.16, 0.22, metal, 0, -0.99, 0.03);
    arm.add(hand);
    body.add(arm);
    arms.push(arm);
  }

  // Enemy weapon mounted in right hand.
  const weapon = new THREE.Group();
  weapon.position.set(0, -1.05, 0.12);
  const gun = buildEnemyGun(variant, palette, { armor, armorDark, metal, dark, glow });
  weapon.add(gun);
  arms[1].add(weapon);

  // A few class-specific details.
  if (heavy) {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.58), armorDark);
    shield.position.set(-w * 0.76, hipY + 0.38 + bodyH * 0.66, 0.05);
    shield.rotation.z = -0.12;
    body.add(shield);
    const shieldLight = box(0.03, 0.68, 0.08, glow, -w * 0.79, hipY + 0.38 + bodyH * 0.66, 0.3);
    body.add(shieldLight);
  }
  if (scout) {
    for (const side of [-1, 1]) {
      const fin = box(0.06, 0.35, 0.22, glow, side * w * 0.4, hipY + 0.5 + bodyH * 0.8, -0.28);
      fin.rotation.z = side * 0.25;
      body.add(fin);
    }
  }
  if (boss) {
    for (const side of [-1, 1]) {
      const cannon = new THREE.Group();
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.65, 10), dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = 0.28;
      cannon.add(barrel);
      const tip = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 12), glow);
      tip.position.z = 0.6;
      cannon.add(tip);
      cannon.position.set(side * w * 0.55, hipY + 0.38 + bodyH * 1.03, -0.05);
      body.add(cannon);
    }
  }

  root.scale.setScalar(scale);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (!o.userData.zone && o !== torso && o !== headMesh) o.userData.zone = 'limb';
    }
  });

  const hitMeshes = [];
  body.traverse((o) => {
    if (o.isMesh && o.userData.zone) hitMeshes.push(o);
  });

  const robot = {
    root,
    body,
    head,
    headMesh,
    torso,
    legs,
    arms,
    weapon,
    materials,
    hitMeshes,
    palette,
    variant,
    height: headY + headSize * 0.7,
    flash: 0,
    baseGlow: glow,
    time: rand(0, 10),
    jet: null,
  };

  // Emissive pulse for a little life.
  const lightStrip = new THREE.PointLight(palette.glow, 2.4, 4.2, 2);
  lightStrip.position.set(0, hipY + bodyH * 0.8, 0.5);
  body.add(lightStrip);
  robot.light = lightStrip;

  return robot;
}

function buildEnemyGun(variant, palette, m) {
  const group = new THREE.Group();
  const bodyMat = m.dark;
  const glow = m.glow;
  if (variant === 'heavy') {
    const body = box(0.32, 0.28, 0.85, bodyMat, 0, 0, 0.28);
    group.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.8, 8), m.metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.9;
    group.add(barrel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 14), glow);
    ring.position.z = 0.78;
    group.add(ring);
    group.add(box(0.16, 0.16, 0.38, m.armor, 0, -0.28, 0.1));
  } else if (variant === 'sniper') {
    const body = box(0.18, 0.2, 1.1, bodyMat, 0, 0, 0.35);
    group.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.15, 8), m.metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.1;
    group.add(barrel);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.38, 10), m.armorDark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.16, 0.3);
    group.add(scope);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.055, 10), glow);
    lens.position.set(0, 0.16, 0.495);
    group.add(lens);
  } else if (variant === 'boss') {
    const body = box(0.36, 0.4, 0.9, m.armorDark, 0, 0, 0.3);
    group.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.95, 10), m.metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.8;
    group.add(barrel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 6, 14), glow);
    ring.position.z = 0.82;
    group.add(ring);
    const ring2 = ring.clone();
    ring2.position.z = 0.52;
    group.add(ring2);
  } else {
    const body = box(0.2, 0.22, 0.65, bodyMat, 0, 0, 0.25);
    group.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.64, 8), m.metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.77;
    group.add(barrel);
    group.add(box(0.06, 0.06, 0.45, glow, 0, 0.14, 0.25));
    const stock = box(0.12, 0.16, 0.26, m.armor, 0, -0.02, -0.12);
    group.add(stock);
  }
  return group;
}

export function createDroneModel({ team = 'red', scale = 1, name = '' } = {}) {
  const palette = TEAM_PALETTES[team] || TEAM_PALETTES.red;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shell = mat(palette.armor, { metalness: 0.55, roughness: 0.3 });
  const dark = mat(palette.dark, { metalness: 0.7, roughness: 0.3 });
  const glow = mat(palette.glow, { emissive: palette.glow, emissiveIntensity: 3.2, metalness: 0.1, roughness: 0.2 });
  const metal = mat(palette.metal, { metalness: 0.8, roughness: 0.3 });
  const materials = [shell, dark, glow, metal];

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), shell);
  core.scale.set(1.2, 0.75, 1);
  core.castShadow = true;
  body.add(core);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glow);
  eye.scale.z = 0.55;
  eye.position.set(0, 0.02, 0.4);
  body.add(eye);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 6, 24), metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.02;
  body.add(ring);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.38, 8), dark);
    pod.rotation.z = Math.PI / 2;
    pod.position.set(side * 0.52, 0.08, 0);
    body.add(pod);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.6, 8), new THREE.MeshBasicMaterial({ color: palette.glow, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.rotation.x = Math.PI;
    flame.position.set(side * 0.52, -0.35, 0);
    body.add(flame);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.12, 0);
  body.add(head);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData.zone = 'body';
  body.add(hit);

  root.scale.setScalar(scale);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return {
    root, body, head, arms: [], legs: [], weapon: null, materials, hitMeshes: [hit], palette,
    variant: 'drone', height: 0.9, flash: 0, time: rand(0, 10), isDrone: true,
    eye, flameLeft: body.children.filter((o) => o.geometry?.type === 'ConeGeometry'),
  };
}

export function animateRobot(robot, dt, { moving = false, speed = 0, aimPitch = 0, firing = 0, dead = false } = {}) {
  robot.time += dt;
  const t = robot.time;
  const isDrone = robot.isDrone;
  if (isDrone) {
    robot.body.position.y = 1.5 + Math.sin(t * 2.4) * 0.1;
    robot.body.rotation.z = Math.sin(t * 1.7) * 0.06;
    robot.root.rotation.z = Math.sin(t * 1.2) * 0.03;
    for (const flame of robot.flameLeft) {
      const s = 0.8 + Math.abs(Math.sin(t * 21)) * 0.45;
      flame.scale.set(1, s, 1);
      flame.material.opacity = 0.45 + Math.random() * 0.35;
    }
    return;
  }
  const moveAmt = moving ? Math.min(1, speed / 4.5) : 0;
  const swing = Math.sin(t * 9.5) * 0.58 * moveAmt;
  robot.legs[0].rotation.x = swing;
  robot.legs[1].rotation.x = -swing;
  robot.legs[0].rotation.z = 0.03;
  robot.legs[1].rotation.z = -0.03;
  robot.arms[0].rotation.x = -swing * 0.7 - 0.05;
  robot.arms[0].rotation.z = 0.08;
  robot.arms[1].rotation.x = -1.36 + aimPitch * 0.45 - firing * 0.14;
  robot.arms[1].rotation.z = -0.07;
  robot.body.position.y = Math.abs(Math.sin(t * 9.5)) * 0.035 * moveAmt + Math.sin(t * 2.2) * 0.012;
  robot.body.rotation.z = Math.sin(t * 9.5) * 0.025 * moveAmt;
  robot.head.rotation.x = -aimPitch * 0.35;
  robot.head.rotation.y = Math.sin(t * 0.9) * (moveAmt > 0.1 ? 0.04 : 0.12);
  if (robot.light) robot.light.intensity = 2.2 + Math.sin(t * 4.2) * 0.4;

  if (robot.flash > 0) {
    robot.flash = Math.max(0, robot.flash - dt);
    const f = robot.flash * 8;
    for (const m of robot.materials) {
      if (m.emissive && m !== robot.baseGlow) {
        m.emissive.setRGB(f * 0.7, f * 0.08, f * 0.03);
      }
    }
    if (robot.flash === 0) {
      for (const m of robot.materials) {
        if (m === robot.baseGlow) continue;
        if (m.userData.baseEmissive !== undefined) m.emissive.setHex(m.userData.baseEmissive);
        else if (m.emissive) m.emissive.setHex(0x000000);
      }
    }
  }
}

export function setRobotOpacity(robot, opacity) {
  for (const m of robot.materials) {
    m.transparent = opacity < 1;
    m.opacity = opacity;
    m.depthWrite = opacity >= 1;
  }
}

export function makeRobotPickup(team = 'blue') {
  const group = new THREE.Group();
  const robot = createRobotModel({ team, variant: 'scout', scale: 0.3 });
  group.add(robot.root);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x1b3148, metalness: 0.7, roughness: 0.3 }));
  group.add(base);
  return group;
}
