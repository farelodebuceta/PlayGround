import * as THREE from 'three';
import { rand, pick, createGlowTexture } from './util.js';

const MAX_SPARKS = 540;
const MAX_DEBRIS = 90;
const MAX_TRACERS = 80;
const MAX_DECALS = 64;

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'effects';
    scene.add(this.group);

    this.glowTex = createGlowTexture('#7ff6ff');
    this.warmTex = createGlowTexture('#ffb35c');
    this.redTex = createGlowTexture('#ff5b4d');
    this.sparkTex = createGlowTexture('#ffd56b');

    this.sparks = [];
    this.debris = [];
    this.tracers = [];
    this.decals = [];
    this.numbers = [];
    this.flashes = [];
    this.rings = [];
    this.shake = 0;
    this.shakeTime = 0;
    this.kickPitch = 0;
    this.kickYaw = 0;

    this.buildSparkPool();
    this.initDebris();
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
  }

  buildSparkPool() {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_SPARKS * 3);
    const colors = new Float32Array(MAX_SPARKS * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.11,
      map: this.sparkTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.sparkPoints = new THREE.Points(geom, mat);
    this.sparkPoints.frustumCulled = false;
    this.group.add(this.sparkPoints);
    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparks.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1, gravity: -9, drag: 0.98, color: new THREE.Color() });
    }
  }

  spawnSpark(position, normal, color = 0xffb552, count = 6, speed = 7, spread = 1, gravity = -12) {
    for (let n = 0; n < count; n++) {
      const s = this.sparks.find((s) => !s.alive);
      if (!s) break;
      s.alive = true;
      s.pos.copy(position);
      s.vel.set(rand(-1, 1) * spread, rand(-1, 1) * spread, rand(-1, 1) * spread).normalize();
      if (normal) s.vel.addScaledVector(normal, 0.9).normalize();
      s.vel.multiplyScalar(rand(0.25, 1) * speed);
      s.life = rand(0.2, 0.55);
      s.max = s.life;
      s.gravity = gravity;
      s.drag = 0.955;
      s.color.set(color);
    }
    this.updateSparkGeometry();
  }

  updateSparkGeometry() {
    const pos = this.sparkPoints.geometry.attributes.position.array;
    const col = this.sparkPoints.geometry.attributes.color.array;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.sparks[i];
      pos[i * 3] = s.pos.x;
      pos[i * 3 + 1] = s.pos.y;
      pos[i * 3 + 2] = s.pos.z;
      const a = s.alive ? Math.max(0, s.life / s.max) : 0;
      col[i * 3] = s.color.r * a;
      col[i * 3 + 1] = s.color.g * a;
      col[i * 3 + 2] = s.color.b * a;
    }
    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    this.sparkPoints.geometry.attributes.color.needsUpdate = true;
  }

  impact(position, normal = new THREE.Vector3(0, 1, 0), color = 0xffc45c, power = 1) {
    this.spawnSpark(position, normal, color, Math.round(5 * power), 5.5 * power, 1.0, -13);
    this.smoke(position, normal, 2 * power);
    this.decal(position, normal, color);
  }

  bloodSpark(position, normal, color = 0xffc45c) {
    this.spawnSpark(position, normal, color, 10, 8, 1.3, -11);
    this.spawnSpark(position, normal, 0xffffff, 3, 4, 0.6, -5);
  }

  smoke(position, normal, amount = 2) {
    for (let i = 0; i < amount; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0x9da9b5,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      sprite.position.copy(position).add(new THREE.Vector3(rand(-0.1, 0.1), rand(-0.1, 0.1), rand(-0.1, 0.1)));
      const size = rand(0.16, 0.38);
      sprite.scale.setScalar(size);
      this.group.add(sprite);
      this.flashes.push({ obj: sprite, life: rand(0.35, 0.7), max: 0.7, grow: rand(1, 2.2), drift: new THREE.Vector3(rand(-0.25, 0.25), rand(0.1, 0.4), rand(-0.25, 0.25)), kind: 'smoke' });
    }
  }

  tracer(start, end, color = 0xffe394, duration = 0.055, width = 0.02) {
    let t = this.tracers.find((t) => !t.alive);
    if (!t) {
      const geom = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      t = { alive: false, mesh, life: 0, max: 1 };
      this.tracers.push(t);
    }
    const dist = start.distanceTo(end);
    if (dist < 0.01) return;
    t.alive = true;
    t.life = duration;
    t.max = duration;
    t.mesh.visible = true;
    t.mesh.position.copy(start).add(end).multiplyScalar(0.5);
    t.mesh.scale.set(width, dist, width);
    const dir = this.tmpA.copy(end).sub(start).normalize();
    t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    t.mesh.material.color.set(color);
    t.mesh.material.opacity = 0.95;
    this.smoke(start, null, 1);
  }

  hitscanBeam(start, end, color = 0x58f6ff, duration = 0.07) {
    this.tracer(start, end, color, duration, 0.014);
    this.tracer(start, end, 0xffffff, duration * 0.55, 0.006);
    this.flashSprite(start, color, 0.6, 0.15, 2.2);
  }

  flashSprite(position, color = 0xffd27a, size = 1, duration = 0.08, kind = 0) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.position.copy(position);
    sprite.scale.setScalar(size);
    this.group.add(sprite);
    this.flashes.push({ obj: sprite, life: duration, max: duration, grow: kind, kind: 'flash' });
    return sprite;
  }

  muzzle(position, color = 0xffc15a, size = 0.45) {
    this.flashSprite(position, color, size * rand(0.85, 1.25), 0.07, 1.6);
    this.spawnSpark(position, null, color, 3, 3, 0.7, -2);
  }

  explosion(position, radius = 3.5, color = 0xff8a37) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sphere.position.copy(position);
    sphere.scale.setScalar(0.3);
    this.group.add(sphere);
    this.flashes.push({ obj: sphere, life: 0.45, max: 0.45, grow: radius, kind: 'sphere' });

    const core = new THREE.PointLight(color, 80, radius * 5.5, 2);
    core.position.copy(position);
    this.group.add(core);
    this.flashes.push({ obj: core, life: 0.38, max: 0.38, grow: 0, kind: 'light' });

    const ringGeom = new THREE.RingGeometry(0.6, 0.76, 40);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe3a7, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;
    this.group.add(ring);
    this.rings.push({ mesh: ring, life: 0.55, max: 0.55, size: radius * 2.4 });

    this.spawnSpark(position, new THREE.Vector3(0, 1, 0), color, 34, radius * 4.2, 1.4, -10);
    this.spawnSpark(position, new THREE.Vector3(0, 1, 0), 0xffffff, 10, radius * 2.5, 1.0, -4);
    for (let i = 0; i < 7; i++) this.debrisPiece(position, color, 1.4);
    this.smoke(position, new THREE.Vector3(0, 1, 0), 7);
    this.addShake(0.14 + radius * 0.03);
  }

  debrisPiece(position, color = 0x888888, force = 1) {
    const d = this.debris.find((d) => !d.alive);
    if (!d) return;
    d.alive = true;
    d.mesh.visible = true;
    d.pos.copy(position);
    d.vel.set(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(1.5, 4.5) * force);
    d.rot.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    d.life = rand(0.8, 1.5);
    d.max = d.life;
    d.mesh.material.color.set(color);
  }

  initDebris() {
    const geo = new THREE.BoxGeometry(0.16, 0.1, 0.2);
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.55, metalness: 0.5, emissive: 0x1a1a1a }));
      mesh.visible = false;
      this.group.add(mesh);
      this.debris.push({ alive: false, mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Vector3(), life: 0, max: 1 });
    }
  }

  decal(position, normal, color = 0xffb04a) {
    let d = this.decals.find((d) => !d.alive);
    if (!d) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.055, 10), mat);
      this.group.add(mesh);
      d = { alive: false, mesh, life: 0, max: 1 };
      this.decals.push(d);
      if (this.decals.length > MAX_DECALS) this.decals.shift();
    }
    d.alive = true;
    d.life = 7;
    d.max = 7;
    d.mesh.visible = true;
    d.mesh.position.copy(position).addScaledVector(normal, 0.006);
    d.mesh.lookAt(this.tmpA.copy(position).add(normal));
    d.mesh.material.opacity = 0.85;
    d.mesh.scale.setScalar(rand(0.8, 1.4));
  }

  damageNumber(position, amount, critical = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.font = '900 58px Arial Black, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = critical ? '#ff3b30' : '#ffd066';
    ctx.shadowBlur = 12;
    ctx.fillStyle = critical ? '#ff766d' : '#fff4cf';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 8;
    const text = String(amount);
    ctx.strokeText(text, 96, 50);
    ctx.fillText(text, 96, 50);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.position.y += 0.4;
    sprite.scale.set(critical ? 1.8 : 1.25, critical ? 0.9 : 0.62, 1);
    sprite.renderOrder = 20;
    this.group.add(sprite);
    this.numbers.push({ sprite, life: 0.8, max: 0.8, vy: rand(0.8, 1.3), tex });
  }

  addShake(amount) {
    this.shake = Math.min(0.6, this.shake + amount);
    this.shakeTime = 0.3;
  }

  kick(pitch, yaw = 0) {
    this.kickPitch += pitch;
    this.kickYaw += yaw;
  }

  update(dt) {
    for (const s of this.sparks) {
      if (!s.alive) continue;
      s.life -= dt;
      if (s.life <= 0) { s.alive = false; continue; }
      s.vel.y += s.gravity * dt;
      s.vel.multiplyScalar(Math.pow(s.drag, dt * 60));
      s.pos.addScaledVector(s.vel, dt);
      if (s.pos.y < 0.02) { s.pos.y = 0.02; s.vel.y *= -0.32; s.vel.x *= 0.8; s.vel.z *= 0.8; }
    }
    this.updateSparkGeometry();

    for (const t of this.tracers) {
      if (!t.alive) continue;
      t.life -= dt;
      if (t.life <= 0) { t.alive = false; t.mesh.visible = false; continue; }
      t.mesh.material.opacity = (t.life / t.max) * 0.9;
      t.mesh.scale.x = t.mesh.scale.z = t.mesh.scale.z * 0.92;
    }

    for (const d of this.debris) {
      if (!d.alive) continue;
      d.life -= dt;
      if (d.life <= 0) { d.alive = false; d.mesh.visible = false; continue; }
      d.vel.y -= 13 * dt;
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y < 0.08) { d.pos.y = 0.08; d.vel.y *= -0.35; d.vel.x *= 0.7; d.vel.z *= 0.7; }
      d.mesh.position.copy(d.pos);
      d.mesh.rotation.x += d.rot.x * dt;
      d.mesh.rotation.y += d.rot.y * dt;
      d.mesh.rotation.z += d.rot.z * dt;
    }

    for (const d of this.decals) {
      if (!d.alive) continue;
      d.life -= dt;
      if (d.life <= 0) { d.alive = false; d.mesh.visible = false; continue; }
      d.mesh.material.opacity = Math.min(0.85, d.life / 2);
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.group.remove(f.obj);
        f.obj.material?.dispose?.();
        this.flashes.splice(i, 1);
        continue;
      }
      const a = f.life / f.max;
      if (f.kind === 'flash') {
        f.obj.material.opacity = a;
        f.obj.scale.multiplyScalar(1 + dt * (4 + f.grow));
      } else if (f.kind === 'smoke') {
        f.obj.material.opacity = a * 0.18;
        f.obj.scale.multiplyScalar(1 + dt * f.grow);
        f.obj.position.addScaledVector(f.drift, dt);
      } else if (f.kind === 'sphere') {
        f.obj.material.opacity = a * 0.7;
        const t = 1 - a;
        f.obj.scale.setScalar(0.4 + t * f.grow);
      } else if (f.kind === 'light') {
        f.obj.intensity = a * 90;
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.group.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); this.rings.splice(i, 1); continue; }
      const t = 1 - r.life / r.max;
      r.mesh.scale.setScalar(0.4 + t * r.size);
      r.mesh.material.opacity = (1 - t) * 0.75;
    }

    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      if (n.life <= 0) {
        this.group.remove(n.sprite);
        n.sprite.material.dispose();
        n.tex.dispose();
        this.numbers.splice(i, 1);
        continue;
      }
      n.sprite.position.y += n.vy * dt;
      n.sprite.material.opacity = Math.min(1, n.life / 0.3);
    }

    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.kickPitch *= Math.exp(-12 * dt);
    this.kickYaw *= Math.exp(-12 * dt);
  }

  initAll() {
    this.initDebris();
  }

  reset() {
    for (const s of this.sparks) s.alive = false;
    for (const d of this.debris) { d.alive = false; d.mesh.visible = false; }
    for (const t of this.tracers) { t.alive = false; t.mesh.visible = false; }
    for (const d of this.decals) { d.alive = false; d.mesh.visible = false; }
    for (const f of this.flashes) this.group.remove(f.obj);
    this.flashes.length = 0;
    for (const r of this.rings) this.group.remove(r.mesh);
    this.rings.length = 0;
    for (const n of this.numbers) this.group.remove(n.sprite);
    this.numbers.length = 0;
    this.updateSparkGeometry();
  }
}
