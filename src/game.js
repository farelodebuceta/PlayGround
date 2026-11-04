import * as THREE from 'three';
import { World } from './world.js';
import { Effects } from './effects.js';
import { WEAPONS, buildViewModel, createViewScene } from './weapons.js';
import { createRobotModel, animateRobot, setRobotOpacity, createDroneModel } from './robots.js';
import { clamp, damp, dampAngle, rand, randInt, pick, shuffle, formatTime, TAU, createTextTexture, createGlowTexture } from './util.js';

const TEAM_CONFIG = {
  blue: { name: 'BLUE-01', armor: 50, speed: 1.04, reload: 0.88, damage: 1.0, body: '#8ad8ff', accent: '#45e8ff' },
  red: { name: 'RED-01', armor: 75, speed: 0.97, reload: 1.0, damage: 1.06, body: '#ff9a84', accent: '#ff7a4a' },
};

const ENEMY_TYPES = {
  scout: {
    name: 'SCOUT', hp: 55, speed: 5.2, damage: 6, interval: 1.0, range: 30, preferred: 12,
    accuracy: 0.68, score: 100, scale: 0.94, sound: 'pistol', variant: 'scout', color: 0xff8c65,
  },
  trooper: {
    name: 'TROOPER', hp: 105, speed: 3.9, damage: 9, interval: 0.85, range: 44, preferred: 18,
    accuracy: 0.7, score: 150, scale: 1.0, sound: 'rifle', variant: 'trooper', color: 0xffc36b,
  },
  heavy: {
    name: 'HEAVY', hp: 240, speed: 2.5, damage: 18, interval: 1.6, range: 20, preferred: 9,
    accuracy: 0.76, score: 300, scale: 1.2, sound: 'shotgun', variant: 'heavy', color: 0xff6e4a,
  },
  sniper: {
    name: 'SNIPER', hp: 85, speed: 3.1, damage: 26, interval: 2.4, range: 74, preferred: 34,
    accuracy: 0.82, score: 250, scale: 1.0, sound: 'sniper', variant: 'sniper', color: 0xffde73,
  },
  drone: {
    name: 'DRONE', hp: 65, speed: 5.8, damage: 7, interval: 0.95, range: 30, preferred: 14,
    accuracy: 0.62, score: 180, scale: 1.0, sound: 'plasma', variant: 'drone', color: 0x73ffd2,
    flying: true, hover: 4.2,
  },
  boss: {
    name: 'WARDEN', hp: 1500, speed: 2.8, damage: 20, interval: 0.78, range: 52, preferred: 16,
    accuracy: 0.76, score: 2500, scale: 1.36, sound: 'rifle', variant: 'boss', color: 0xff5c2e,
    boss: true, palette: 'boss',
  },
};

const WAVE_DEFS = [
  null,
  { title: 'WAVE 01', sub: 'SHOCKWAVE PATROL', objective: 'ELIMINATE THE SHOCKWAVE PATROL', enemies: ['scout', 'scout', 'trooper', 'scout', 'trooper'] },
  { title: 'WAVE 02', sub: 'CITY RESPONSE', objective: 'BREAK THE CITY RESPONSE', enemies: ['trooper', 'scout', 'sniper', 'trooper', 'scout', 'trooper', 'sniper'] },
  { title: 'WAVE 03', sub: 'HEAVY METAL', objective: 'SURVIVE THE HEAVY RESPONSE', enemies: ['trooper', 'heavy', 'sniper', 'scout', 'trooper', 'heavy', 'sniper', 'scout'] },
  { title: 'WAVE 04', sub: 'THE VENUS WARDEN', objective: 'DESTROY THE VENUS WARDEN', enemies: ['boss', 'scout', 'scout', 'trooper'] },
];

const ENEMY_NAMES = ['BOLT-9', 'RIVET', 'MAGENTA', 'VEX-3', 'TINMAN', 'GLITCH', 'SCRAPHEAP', 'AXLE', 'NULL', 'KILROY', 'SOLDER', 'WELD', 'ZERO-K', 'CINDER', 'MOTH', 'SPANNER', 'OZONE', 'HAL-8'];
const BOT_CHATTER = {
  start: [
    'new chassis in the city. everybody be nice.',
    'fresh paint. shame about the everything else.',
    'i give the new unit thirty seconds.',
    'welcome to cityscape. the exit is a myth.',
  ],
  kill: [
    'scrap happens.',
    'did anyone get the serial number on that?',
    'clean shot. annoyingly clean.',
    'that one is going in the parts bin.',
    'the floor is littered with ambition.',
  ],
  playerKill: [
    'okay, that one had velocity.',
    'who taught the new unit to aim?',
    'noted. do not stand in front of it.',
    'the optics on that chassis are rude.',
  ],
  low: [
    'your hull is making a sound. you should fix that.',
    'perhaps consider not being shot.',
    'if you can hear this, you are leaking.',
  ],
  venus: [
    'the portal is real. that is the bad news.',
    'venus is a furnace with a parking problem.',
    'the warden has been waiting a very long time.',
  ],
  reply: [
    'copy that.',
    'bold words from a walking toaster.',
    'loud and clear, shiny.',
    'noted. try to stay intact.',
    'the arena hears you.',
    'charming. anyway.',
  ],
  wave: [
    'here they come. keep your optics level.',
    'movement. lots of movement.',
    'the city is waking up.',
    'do not let them flank. they love flanking.',
  ],
};

class Enemy {
  constructor(game, typeName, position, name, team) {
    this.game = game;
    this.type = ENEMY_TYPES[typeName];
    this.typeName = typeName;
    this.name = name;
    this.team = team;
    this.isBoss = !!this.type.boss;
    this.flying = !!this.type.flying;
    this.alive = true;
    this.dying = false;
    this.deathTimer = 0;
    this.health = this.type.hp;
    this.maxHealth = this.type.hp;
    this.fireTimer = rand(0.8, 2.3);
    this.losTimer = rand(0, 0.2);
    this.hasLos = false;
    this.moveTimer = rand(0, 0.3);
    this.moveDir = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.strafe = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = rand(1, 3);
    this.flash = 0;
    this.hoverPhase = rand(0, TAU);
    this.shots = 0;
    this.summoned = false;
    this.laser = null;
    this.laserTimer = 0;
    this.spawnTimer = 0.9;

    const palette = this.type.palette || (team === 'red' ? 'red' : 'blue');
    this.robot = this.typeName === 'drone'
      ? createDroneModel({ team, scale: this.type.scale, name })
      : createRobotModel({ team: palette, variant: this.type.variant, scale: this.type.scale, name });
    this.root = this.robot.root;
    this.root.position.copy(position);
    if (this.flying) this.root.position.y = this.type.hover;
    this.root.scale.setScalar(0.01 * this.type.scale);
    this.targetScale = this.type.scale;
    this.spawnTimer = 0.75;
    game.scene.add(this.root);
    for (const m of this.robot.hitMeshes) m.userData.enemy = this;

    // Floating callsign.
    const tag = createTextTexture(name, {
      width: 512, height: 96, fg: team === 'red' ? '#ffb7a8' : '#b8ecff',
      glow: team === 'red' ? '#ff5d46' : '#3cdbff', font: '700 48px Arial, sans-serif',
    });
    const tagMat = new THREE.SpriteMaterial({ map: tag, transparent: true, opacity: 0.82, depthWrite: false });
    this.tag = new THREE.Sprite(tagMat);
    this.tag.scale.set(this.isBoss ? 3.2 : 1.8, this.isBoss ? 0.6 : 0.34, 1);
    this.tag.position.y = this.robot.height + 0.35;
    this.root.add(this.tag);

    if (this.isBoss) {
      this.aura = new THREE.PointLight(0xff4f22, 20, 9, 2);
      this.aura.position.y = 2;
      this.root.add(this.aura);
    }

    // Spawn flash.
    game.effects.flashSprite(position.clone().add(new THREE.Vector3(0, 1, 0)), this.type.color, 1.8, 0.4, 2.5);
    game.effects.spawnSpark(position.clone().add(new THREE.Vector3(0, 0.4, 0)), new THREE.Vector3(0, 1, 0), this.type.color, 14, 5, 1, 2);
  }

  get center() {
    return new THREE.Vector3(this.root.position.x, this.root.position.y + (this.robot.height || 1.8) * 0.56, this.root.position.z);
  }

  get eye() {
    return new THREE.Vector3(this.root.position.x, this.root.position.y + (this.robot.height || 1.8) * 0.88, this.root.position.z);
  }

  takeDamage(amount, { headshot = false, weapon = 'P-9', point = null } = {}) {
    if (!this.alive) return;
    this.health -= amount;
    this.flash = 0.14;
    this.robot.flash = 0.14;
    const spherePoint = point || this.center;
    this.game.effects.bloodSpark(spherePoint, new THREE.Vector3(0, 0.3, 0).normalize(), this.type.color);
    this.game.effects.damageNumber(spherePoint, Math.round(amount), headshot);
    if (this.health <= 0) {
      this.die({ headshot, weapon });
    }
  }

  die({ headshot = false, weapon = 'P-9' } = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.dying = true;
    this.deathTimer = 0;
    this.health = 0;
    const deathPos = this.center;
    this.game.effects.explosion(deathPos, this.isBoss ? 8.5 : 2.5, this.type.color);
    this.game.effects.spawnSpark(deathPos, new THREE.Vector3(0, 1, 0), 0xffd27a, this.isBoss ? 60 : 22, this.isBoss ? 14 : 8, 1.5, -10);
    this.game.audio.play('explosion', { volume: this.isBoss ? 1.2 : 0.65 });
    this.game.audio.play('kill', { volume: 0.8 });
    this.game.onEnemyKilled(this, headshot, weapon);
    if (this.laser) this.laser.visible = false;
    if (this.tag) this.tag.visible = false;
  }

  update(dt) {
    if (this.dying) {
      this.deathTimer += dt;
      this.deathTimer += dt * 0.2;
      const t = this.deathTimer;
      if (t < 0.9) {
        this.root.rotation.z += dt * 2.6 * (this.strafe > 0 ? 1 : -1);
        this.root.position.y -= dt * 0.5;
      } else {
        this.root.position.y -= dt * 0.8;
      }
      setRobotOpacity(this.robot, Math.max(0, 1 - t / 2.3));
      if (t > 2.2) this.remove();
      return;
    }

    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      const k = clamp(1 - this.spawnTimer / 0.75, 0, 1);
      const s = this.targetScale * (0.2 + k * 0.8);
      this.root.scale.setScalar(s);
      if (this.spawnTimer <= 0) this.root.scale.setScalar(this.targetScale);
      return;
    }

    const game = this.game;
    const p = game.player;
    const targetPos = p.position;
    const targetEye = new THREE.Vector3(p.position.x, p.position.y + p.eyeHeight, p.position.z);
    const toTarget = targetEye.clone().sub(this.eye);
    const distance = toTarget.length();
    const dir = toTarget.normalize();

    // Prefer targets, maintain spacing.
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = rand(1.2, 3.8);
      this.strafe *= -1;
    }

    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = rand(0.12, 0.25);
      this.hasLos = this.game.hasLineOfSight(this.eye, targetEye);
    }

    let desired = new THREE.Vector3();
    if (!this.hasLos || distance > this.type.preferred * 1.55) {
      desired.copy(dir);
    } else if (distance < this.type.preferred * 0.72) {
      desired.copy(dir).multiplyScalar(-0.7);
    }
    // Lateral motion to feel alive.
    if (this.hasLos && distance < this.type.range) {
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafe * 0.7);
      desired.add(side);
      if (!this.isBoss) desired.addScaledVector(dir, -0.1);
    }

    this.moveTimer -= dt;
    if (this.moveTimer <= 0) {
      this.moveTimer = 0.2;
      const probe = this.eye.clone();
      probe.y -= 0.5;
      const wish = desired.clone().normalize();
      if (wish.lengthSq() > 0.01 && this.game.worldRaycast(probe, wish, 2.0)) {
        const options = [-0.8, 0.8, -1.55, 1.55];
        for (const turn of options) {
          const alt = wish.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
          if (!this.game.worldRaycast(probe, alt, 2.0)) { wish.copy(alt); break; }
        }
        desired.copy(wish);
      }
      this.moveDir.copy(desired);
    }

    // Separation from other enemies.
    for (const other of game.enemies) {
      if (other === this || other.dying) continue;
      const dx = this.root.position.x - other.root.position.x;
      const dz = this.root.position.z - other.root.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 0.01 && d2 < 2.6 * 2.6) {
        const d = Math.sqrt(d2);
        this.moveDir.x += (dx / d) * (2.6 - d) * 0.4;
        this.moveDir.z += (dz / d) * (2.6 - d) * 0.4;
      }
    }
    this.moveDir.y = 0;
    if (this.moveDir.lengthSq() > 0.001) this.moveDir.normalize();

    const speedScale = this.hasLos ? 0.68 : 1;
    this.vel.x = damp(this.vel.x, this.moveDir.x * this.type.speed * speedScale, 7, dt);
    this.vel.z = damp(this.vel.z, this.moveDir.z * this.type.speed * speedScale, 7, dt);

    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.3;
    if (this.flying) {
      const hover = this.type.hover + Math.sin(game.elapsed * 1.6 + this.hoverPhase) * 0.32;
      this.root.position.y = damp(this.root.position.y, hover, 3, dt);
      this.root.position.x += this.vel.x * dt;
      this.root.position.z += this.vel.z * dt;
    } else {
      this.root.position.x += this.vel.x * dt;
      this.root.position.z += this.vel.z * dt;
      const ground = game.world.getGroundHeight(this.root.position.x, this.root.position.z, this.root.position.y);
      this.root.position.y = damp(this.root.position.y, ground, 14, dt);
      game.world.resolveHorizontal(this.root.position, 0.55 * this.type.scale, (this.robot.height || 1.8) * 0.8);
    }

    // Face the target.
    const desiredYaw = Math.atan2(dir.x, dir.z);
    this.root.rotation.y = dampAngle(this.root.rotation.y, desiredYaw, 8, dt);

    // Animate.
    animateRobot(this.robot, dt, { moving, speed: Math.hypot(this.vel.x, this.vel.z), aimPitch: Math.asin(clamp(dir.y, -1, 1)), firing: 0 });

    // Nameplate fade by distance.
    if (this.tag) {
      const d = game.camera.position.distanceTo(this.root.position);
      this.tag.material.opacity = clamp(1.15 - d / 48, 0.16, 0.9);
    }
    if (this.aura) this.aura.intensity = 16 + Math.sin(game.elapsed * 5) * 5;

    // Shooting.
    this.fireTimer -= dt;
    if (this.laser) {
      this.laserTimer -= dt;
      if (this.laserTimer <= 0) this.laser.visible = false;
    }
    if (game.state === 'playing' && this.hasLos && distance < this.type.range && this.fireTimer <= 0 && !p.dead) {
      this.fire(distance, targetEye);
    }

    // Boss extras.
    if (this.isBoss && this.health < this.maxHealth * 0.6 && !this.summoned) {
      this.summoned = true;
      game.summonBossAdds(this);
    }
  }

  fire(distance, targetEye) {
    const game = this.game;
    const muzzle = new THREE.Vector3();
    if (this.robot.weapon) this.robot.weapon.getWorldPosition(muzzle);
    else muzzle.copy(this.root.position).add(new THREE.Vector3(0, 0.4, 0));

    this.fireTimer = this.type.interval * rand(0.82, 1.25);
    this.shots++;
    const distAtten = clamp(1 - distance / (this.type.range * 1.4), 0.2, 1);
    const playerAngular = game.playerSpeed / 10;
    const chance = clamp(this.type.accuracy * distAtten - playerAngular * 0.14, 0.16, 0.93);
    const hit = Math.random() < chance;
    const end = targetEye.clone();
    if (!hit) {
      end.x += rand(-1.4, 1.4);
      end.y += rand(-0.7, 1.2);
      end.z += rand(-1.4, 1.4);
    } else {
      end.x += rand(-0.2, 0.2);
      end.y += rand(-0.15, 0.25);
      end.z += rand(-0.2, 0.2);
    }

    const beamColor = this.typeName === 'sniper' ? 0xffd35a : this.typeName === 'heavy' ? 0xff8d55 : this.type.color;
    game.effects.muzzle(muzzle, beamColor, this.isBoss ? 0.9 : 0.45);
    game.effects.tracer(muzzle, end, beamColor, 0.075, this.isBoss ? 0.035 : 0.018);
    game.audio.play(this.type.sound, { volume: clamp(0.55 - distance / 100, 0.14, 0.45) });
    if (hit) {
      const dmg = this.type.damage * (this.isBoss ? 1 : rand(0.9, 1.1));
      game.damagePlayer(dmg, this);
      game.effects.flashSprite(end, 0xff8a5c, 0.28, 0.16, 1.8);
    } else {
      game.effects.spawnSpark(end, new THREE.Vector3(0, 0, 1), beamColor, 3, 3, 0.7, -8);
    }

    if (this.typeName === 'sniper' || this.isBoss) {
      if (!this.laser) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const mat = new THREE.LineBasicMaterial({ color: this.isBoss ? 0xff4d24 : 0xffd35a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
        this.laser = new THREE.Line(geo, mat);
        this.laser.frustumCulled = false;
        game.scene.add(this.laser);
      }
      this.laser.visible = true;
      this.laserTimer = 0.45;
      const pos = this.laser.geometry.attributes.position;
      pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
      pos.setXYZ(1, targetEye.x, targetEye.y, targetEye.z);
      pos.needsUpdate = true;
      this.laser.geometry.computeBoundingSphere();
    }
  }

  remove() {
    if (this._removed) return;
    this._removed = true;
    if (this.laser) {
      this.game.scene.remove(this.laser);
      this.laser.geometry.dispose();
      this.laser.material.dispose();
    }
    this.game.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
    const idx = this.game.enemies.indexOf(this);
    if (idx >= 0) this.game.enemies.splice(idx, 1);
  }
}

export class Game {
  constructor({ renderer, scene, camera, composer, ui, audio }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = composer;
    this.ui = ui;
    this.audio = audio;
    this.world = new World(scene);
    this.effects = new Effects(scene, camera);
    this.view = createViewScene();
    this.view.scene.add(this.view.camera);
    this.viewRig = new THREE.Group();
    this.view.camera.add(this.viewRig);

    this.state = 'menu';
    this.time = 0;
    this.elapsed = 0;
    this.runTime = 0;
    this.team = 'blue';
    this.player = this.makePlayer('blue');
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.waveQueue = [];
    this.wave = 0;
    this.waveState = 'idle';
    this.waveDelay = 0;
    this.transition = null;
    this.deathTimer = 0;
    this.endTimer = 0;
    this.shots = 0;
    this.hits = 0;
    this.kills = 0;
    this.headshots = 0;
    this.score = 0;
    this.combo = 0;
    this.lastKillAt = -99;
    this.chatTimer = rand(6, 12);
    this.pingTimer = 0;
    this.minimapTimer = 0;
    this.mouseDown = false;
    this.triggerPressed = false;
    this.mouseRight = false;
    this.ads = false;
    this.pointerLocked = false;
    this.dragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.keys = {};
    this.jumpQueued = false;
    this.overdrive = 0;
    this.playerSpeed = 0;
    this.weaponViews = [];
    this.currentWeapon = 0;
    this.ammo = WEAPONS.map((w) => w.mag);
    this.reloadTimer = 0;
    this.reloading = false;
    this.fireCooldown = 0;
    this.switchTimer = 0;
    this.recoil = 0;
    this.sway = { x: 0, y: 0 };
    this.adsLerp = 0;
    this.menuActors = null;
    this.menuAngle = 0;
    this.lastStep = 0;
    this.botNames = shuffle(ENEMY_NAMES);
    this.nameCursor = 0;
    this.raycaster = new THREE.Raycaster();
    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
    this.viewport = { w: innerWidth, h: innerHeight };

    this.buildWeaponViews('blue');
    this.bindEvents();
    this.setupMenuScene();

    this.ui.onChat = (text) => this.sendPlayerChat(text);
    this.ui.onChatClose = () => {
      if (this.state === 'playing') this.requestPointerLock();
    };
    this.ui.onTouchWeapon = (what) => {
      if (this.state !== 'playing') return;
      if (what === 'reload') this.startReload();
      if (what === 'swap') this.switchWeapon((this.currentWeapon + 1) % WEAPONS.length);
    };
  }

  makePlayer(team) {
    return {
      position: new THREE.Vector3(0, 0, 26),
      velocity: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      health: 100,
      armor: TEAM_CONFIG[team].armor,
      eyeHeight: 1.68,
      crouch: 0,
      dead: false,
      onGround: true,
      jumps: 0,
      lastDamage: -99,
      walkBob: 0,
      recoilPitch: 0,
      recoilYaw: 0,
    };
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    window.addEventListener('keydown', (e) => {
      if (this.ui.isChatOpen()) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      if (!this.runActive()) return;
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'Tab') this.ui.openChat();
      if (e.code === 'KeyC') this.player.crouch = 1;
      if (e.code === 'Escape') this.pauseGame();
      if (e.code === 'KeyE') this.tryPortal();
      if (/^Digit[1-6]$/.test(e.code)) this.switchWeapon(Number(e.code.slice(-1)) - 1);
      if (e.code === 'KeyM') { this.audio.toggleMute(); }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyC') this.player.crouch = 0;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing' || this.ui.isChatOpen()) return;
      if (this.pointerLocked) {
        this.look(e.movementX, e.movementY);
      } else if (this.dragging) {
        this.look(e.movementX || e.clientX - this.lastMouse.x, e.movementY || e.clientY - this.lastMouse.y);
      }
      this.lastMouse.x = e.clientX;
      this.lastMouse.y = e.clientY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.state === 'playing' && !this.ui.isChatOpen()) {
        if (!this.pointerLocked && !this.ui.mobile) {
          this.dragging = true;
          this.lastMouse.x = e.clientX;
          this.lastMouse.y = e.clientY;
          this.requestPointerLock();
        }
        if (e.button === 0) {
          this.mouseDown = true;
          this.triggerPressed = true;
        }
        if (e.button === 2) this.mouseRight = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.mouseRight = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      if (this.state === 'playing' && !this.ui.isChatOpen()) {
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        this.switchWeapon((this.currentWeapon + dir + WEAPONS.length) % WEAPONS.length);
      }
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked && this.state === 'playing' && !this.ui.isChatOpen()) {
        this.pauseGame();
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing' && !this.ui.isChatOpen()) this.pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });
  }

  look(dx, dy) {
    const sens = 0.0021 * this.ui.sensitivity * (this.ads ? (WEAPONS[this.currentWeapon].scope ? 0.35 : 0.65) : 1);
    this.player.yaw -= dx * sens;
    this.player.pitch = clamp(this.player.pitch - dy * sens, -1.42, 1.42);
    this.sway.x = damp(this.sway.x, -dx * 0.0007, 10, 1 / 60);
    this.sway.y = damp(this.sway.y, dy * 0.0007, 10, 1 / 60);
  }

  runActive() {
    return this.state === 'playing';
  }

  requestPointerLock() {
    if (this.ui.mobile || this.state !== 'playing') return;
    const canvas = this.renderer.domElement;
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch {}
    }
  }

  setupMenuScene() {
    this.state = 'menu';
    this.world.buildCity();
    this.scene.userData.sun.intensity = 2.5;
    this.menuActors = new THREE.Group();
    this.menuActors.name = 'menu-actors';
    this.scene.add(this.menuActors);

    // A stage for two duelling robots, placed on the right side of the title.
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x0b1d30, metalness: 0.7, roughness: 0.32 });
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.8, 8), stageMat);
    stage.position.set(8, 0.4, 1);
    stage.receiveShadow = true;
    this.menuActors.add(stage);
    const stageRing = new THREE.Mesh(new THREE.TorusGeometry(4.45, 0.06, 6, 40), new THREE.MeshBasicMaterial({ color: 0x3ee6ff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    stageRing.rotation.x = -Math.PI / 2;
    stageRing.position.set(8, 0.83, 1);
    this.menuActors.add(stageRing);

    const blue = createRobotModel({ team: 'blue', variant: 'trooper', scale: 1.45, name: 'blue-menu' });
    blue.root.position.set(6.6, 0.8, 1.8);
    blue.root.rotation.y = Math.PI * 0.72;
    this.menuActors.add(blue.root);
    const red = createRobotModel({ team: 'red', variant: 'heavy', scale: 1.45, name: 'red-menu' });
    red.root.position.set(9.4, 0.8, 0.2);
    red.root.rotation.y = -Math.PI * 0.7;
    this.menuActors.add(red.root);
    this.menuBlue = blue;
    this.menuRed = red;

    const spot1 = new THREE.SpotLight(0x66e9ff, 140, 34, 0.55, 0.5, 1.2);
    spot1.position.set(4, 15, 6);
    spot1.target.position.set(6.6, 1.5, 1.8);
    this.menuActors.add(spot1, spot1.target);
    const spot2 = new THREE.SpotLight(0xff8b5b, 130, 34, 0.55, 0.5, 1.2);
    spot2.position.set(11, 14, -2);
    spot2.target.position.set(9.4, 1.6, 0.2);
    this.menuActors.add(spot2, spot2.target);

    const holo = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.02, 5, 60), new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false }));
    holo.position.set(8, 3.6, 1);
    holo.rotation.x = Math.PI / 2.3;
    this.menuActors.add(holo);
    this.menuHolo = holo;

    this.menuAngle = 0.5;
    this.camera.fov = 58;
    this.camera.updateProjectionMatrix();
    this.audio.setMusicMode('menu');
    this.updateMenuCamera(0, true);
  }

  removeMenuScene() {
    if (!this.menuActors) return;
    this.scene.remove(this.menuActors);
    this.menuActors.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      }
    });
    this.menuActors = null;
    this.menuBlue = null;
    this.menuRed = null;
  }

  updateMenuCamera(dt, snap = false) {
    this.menuAngle += dt * 0.06;
    const a = this.menuAngle;
    const target = new THREE.Vector3(3.6, 2.8, 0);
    const pos = new THREE.Vector3(3.6 + Math.cos(a) * 15.5, 7.2 + Math.sin(a * 0.8) * 0.8, 0 + Math.sin(a) * 13.5);
    if (snap) this.camera.position.copy(pos);
    else this.camera.position.lerp(pos, 1 - Math.exp(-1.8 * dt));
    this.camera.lookAt(target);
    if (this.menuBlue) {
      animateRobot(this.menuBlue, dt, { moving: false, speed: 0 });
      animateRobot(this.menuRed, dt, { moving: false, speed: 0 });
      this.menuBlue.head.rotation.y = Math.sin(this.time * 0.5) * 0.25;
      this.menuRed.head.rotation.y = -Math.sin(this.time * 0.5) * 0.25;
    }
    if (this.menuHolo) {
      this.menuHolo.rotation.z += dt * 0.2;
      this.menuHolo.position.y = 3.6 + Math.sin(this.time * 1.1) * 0.15;
    }
  }

  buildWeaponViews(team) {
    if (this.activeView) this.activeView.group.visible = false;
    for (const v of this.weaponViews) {
      this.viewRig.remove(v.group);
      v.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
    }
    this.weaponViews = WEAPONS.map((config) => {
      const view = buildViewModel(config, team);
      view.group.visible = false;
      this.viewRig.add(view.group);
      return view;
    });
    this.activeView = this.weaponViews[this.currentWeapon];
    this.activeView.group.visible = true;
  }

  start(team = 'blue') {
    this.team = team === 'red' ? 'red' : 'blue';
    this.removeMenuScene();
    this.ui.hideGameOver();
    this.ui.showHUD();
    this.ui.setTeam(this.team, TEAM_CONFIG[this.team].name);
    this.ui.setSector('CITYSCAPE');
    this.ui.setBoss(false);
    this.ui.setFade(0, 0.5);
    this.resetRun();
    this.audio.init();
    this.audio.setMusicMode('combat');
    this.requestPointerLock();
    setTimeout(() => {
      if (this.state === 'playing' && !this.pointerLocked && !this.ui.mobile) this.ui.toast('CLICK THE ARENA TO CAPTURE YOUR MOUSE', 3200);
    }, 1400);
  }

  resetRun() {
    this.state = 'playing';
    this.player = this.makePlayer(this.team);
    this.player.position.copy(this.world.playerSpawn);
    this.player.yaw = 0;
    this.player.pitch = -0.02;
    this.enemies = [];
    for (const p of this.projectiles) { this.scene.remove(p.mesh); }
    this.projectiles = [];
    for (const p of this.pickups) { this.scene.remove(p.group); }
    this.pickups = [];
    this.effects.reset();
    this.buildWeaponViews(this.team);
    this.currentWeapon = 0;
    this.ammo = WEAPONS.map((w) => w.mag);
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.switchTimer = 0;
    this.triggerPressed = false;
    this.mouseDown = false;
    this.mouseRight = false;
    this.jumpQueued = false;
    this.overdrive = 0;
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shots = 0;
    this.hits = 0;
    this.combo = 0;
    this.lastKillAt = -99;
    this.runTime = 0;
    this.elapsed = 0;
    this.chatTimer = rand(6, 11);
    this.wave = 1;
    this.startWave(1);
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();
    this.ui.setWeapon(0, { mag: this.ammo[0], reloading: false, reloadProgress: 0 });
    this.ui.setBots(0);
    this.ui.setPing(18);
    this.ui.chat('ARENA', 'Welcome to Cityscape. Weapons free.', 'system');
    this.ui.chat(TEAM_CONFIG[this.team].name, 'Booting combat chassis... done. Let’s make a mess.', this.team, true);
    this.ui.setFade(0, 0.8);
  }

  startWave(n) {
    this.wave = n;
    const def = WAVE_DEFS[n];
    this.waveState = 'spawning';
    this.waveQueue = [];
    this.waveSpawnTimer = 0.8;
    this.waveDelay = 0;
    const names = shuffle(ENEMY_NAMES).slice(0, def.enemies.length);
    def.enemies.forEach((type, i) => {
      this.waveQueue.push({ type, delay: i === 0 ? 0.7 : 0.85 + i * 0.55, name: type === 'boss' ? 'THE VENUS WARDEN' : (names[i] || 'UNIT') });
    });
    this.ui.waveBanner(def.title, def.sub, n === 4 ? 'PRIME SIGNAL' : 'INCOMING');
    this.ui.objective.textContent = def.objective;
    this.ui.toast(n === 4 ? 'PRIME UNIT DETECTED' : 'WAVE INCOMING', 2200);
    if (n === 4) {
      this.audio.setMusicMode('boss');
      this.audio.play('boss');
      this.ui.setBoss(true, 'THE VENUS WARDEN', 1);
    } else {
      this.audio.play('wave');
      this.audio.setMusicMode('combat');
    }
    this.wave = n;
    this.ui.setBots(def.enemies.length);
    this.chatTimer = 0;
  }

  spawnWaveEnemy(entry) {
    const type = entry.type;
    const spawn = this.chooseSpawn();
    const team = this.team === 'red' ? 'blue' : 'red';
    const enemy = new Enemy(this, type, spawn, entry.name, team);
    this.enemies.push(enemy);
    this.ui.setBots(this.enemies.filter((e) => !e.dying).length);
    if (type === 'boss') {
      this.ui.waveBanner('PRIME UNIT', 'THE VENUS WARDEN', 'BOSS');
      this.audio.play('boss');
      this.ui.setBoss(true, 'THE VENUS WARDEN', 1);
      this.effects.explosion(spawn.clone().add(new THREE.Vector3(0, 2, 0)), 5, 0xff5c2e);
      this.effects.addShake(0.25);
    }
  }

  chooseSpawn() {
    const candidates = shuffle(this.world.spawnPoints);
    let best = candidates[0].clone();
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const d = candidate.distanceTo(this.player.position);
      const occupied = this.enemies.some((e) => e.root.position.distanceTo(candidate) < 3);
      const score = d - (occupied ? 30 : 0) + rand(0, 8);
      if (score > bestScore) { bestScore = score; best = candidate.clone(); }
    }
    best.y = this.world.getGroundHeight(best.x, best.z, 0.1);
    return best;
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'menu') {
      this.world.update(dt, this.time);
      this.effects.update(dt);
      this.updateMenuCamera(dt);
      return;
    }
    if (this.state === 'paused') {
      return;
    }
    if (this.state === 'transition') {
      this.updateTransition(dt);
      this.world.update(dt, this.time);
      this.effects.update(dt);
      this.updateViewmodel(dt);
      return;
    }
    if (this.state === 'playing') {
      this.elapsed += dt;
      this.runTime += dt;
      this.updatePlayer(dt);
      this.updateWeapon(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updatePickups(dt);
      this.updateWave(dt);
      this.updateChat(dt);
      this.updatePings(dt);
      this.updateScoreCombo(dt);
      this.world.update(dt, this.time);
      this.effects.update(dt);
      this.updateViewmodel(dt);
      this.updateHUD(dt);
    } else if (this.state === 'dead') {
      this.deathTimer += dt;
      this.world.update(dt, this.time);
      this.effects.update(dt);
      this.updateEnemies(dt);
      this.updateDeathCamera(dt);
      if (this.deathTimer > 2.35) {
        this.state = 'ended';
        this.showEnd(false);
      }
    } else if (this.state === 'won') {
      this.endTimer += dt;
      this.world.update(dt, this.time);
      this.effects.update(dt);
      this.updateEnemies(dt);
      this.updateVictoryCamera(dt);
      if (this.endTimer > 2.2) {
        this.state = 'ended';
        this.showEnd(true);
      }
    } else if (this.state === 'ended') {
      this.world.update(dt, this.time);
      this.effects.update(dt);
    }
  }

  updateTransition(dt) {
    const tr = this.transition;
    if (!tr) return;
    tr.t += dt;
    if (!tr.swapped && tr.t > 0.8) {
      tr.swapped = true;
      this.world.disposeLights();
      this.world.buildVenus();
      this.player.position.copy(this.world.playerSpawn);
      this.player.velocity.set(0, 0, 0);
      this.player.yaw = 0;
      this.player.pitch = 0;
      this.player.health = Math.max(this.player.health, 80);
      this.player.armor = Math.max(this.player.armor, 40);
      this.clearEnemies();
      this.clearProjectiles();
      this.clearPickups();
      this.wave = 4;
      this.waveState = 'idle';
      this.ui.setBoss(false);
      this.ui.setSector('VENUS');
      this.ui.objective.textContent = 'DESTROY THE VENUS WARDEN';
      this.ui.setBots(0);
      this.camera.position.set(0, 1.68, 27);
      this.audio.setMusicMode('boss');
      this.audio.play('portal');
    }
    if (tr.swapped && tr.t > 1.1) this.ui.setFade(0, 1.0);
    if (tr.t > 2.1) {
      this.ui.setFade(0, 0.5);
      this.transition = null;
      this.state = 'playing';
      this.startWave(4);
      this.ui.waveBanner('VENUS', 'WARDEN’S FORGE // PRIME SECTOR', 'SECTOR 02');
      this.ui.toast('WELCOME TO VENUS. IT IS NOT A VACATION.', 3000);
      this.ui.chat('ARENA', 'Sector transition complete. The Warden has noticed you.', 'system');
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;

    // Touch look.
    if (this.ui.mobile) {
      const [lx, ly] = this.ui.consumeLook();
      if (lx || ly) {
        this.player.yaw -= lx * 0.0024 * this.ui.sensitivity;
        this.player.pitch = clamp(this.player.pitch - ly * 0.0024 * this.ui.sensitivity, -1.42, 1.42);
      }
      if (this.ui.touch.jump) { this.jumpQueued = true; this.ui.touch.jump = false; }
      if (this.ui.touch.firePressed) {
        this.triggerPressed = true;
        this.ui.touch.firePressed = false;
      }
      if (this.ui.touch.fire) this.mouseDown = true;
      else if (!this.mouseDown || !this.ui.touch.fire) this.mouseDown = this.ui.touch.fire;
    }

    const chatBlocked = this.ui.isChatOpen();
    let forward = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    let strafe = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    if (this.ui.mobile) {
      forward = -this.ui.touch.moveY;
      strafe = this.ui.touch.moveX;
    }
    if (chatBlocked) { forward = 0; strafe = 0; this.mouseDown = false; this.triggerPressed = false; }
    const sprint = (this.keys.ShiftLeft || this.keys.ShiftRight) && !p.crouch && forward > 0 && !this.ads;
    const crouching = !!this.keys.KeyC;
    p.crouch = damp(p.crouch, crouching ? 1 : 0, 12, dt);
    const speedBase = sprint ? 9.4 : crouching ? 3.2 : 6.2;
    const speed = speedBase * TEAM_CONFIG[this.team].speed;
    const fwd = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const wish = new THREE.Vector3().addScaledVector(fwd, forward).addScaledVector(right, strafe);
    if (wish.lengthSq() > 1) wish.normalize();
    const accel = p.onGround ? 55 : 14;
    const targetVx = wish.x * speed;
    const targetVz = wish.z * speed;
    p.velocity.x = damp(p.velocity.x, targetVx, accel / 10, dt);
    p.velocity.z = damp(p.velocity.z, targetVz, accel / 10, dt);

    // Jumping and thruster double jump.
    if (this.jumpQueued && !chatBlocked) {
      if (p.onGround) {
        p.velocity.y = 7.6;
        p.onGround = false;
        p.jumps = 1;
        this.audio.play('jump');
        this.effects.spawnSpark(p.position.clone(), new THREE.Vector3(0, 1, 0), 0x8fefff, 6, 2.4, 0.8, -4);
      } else if (p.jumps < 2) {
        p.velocity.y = 7.0;
        p.jumps = 2;
        this.audio.play('jump', { volume: 0.8 });
        this.effects.flashSprite(p.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0x58f6ff, 1.0, 0.25, 2.5);
        this.effects.spawnSpark(p.position.clone(), new THREE.Vector3(0, -1, 0), 0x58f6ff, 12, 4, 1, -3);
      }
      this.jumpQueued = false;
    }

    // Gravity.
    p.velocity.y -= 21.5 * dt;
    const nextX = p.position.x + p.velocity.x * dt;
    const nextZ = p.position.z + p.velocity.z * dt;
    p.position.x = nextX;
    p.position.z = nextZ;
    this.world.resolveHorizontal(p.position, 0.48, 1.7);
    p.position.y += p.velocity.y * dt;
    const ground = this.world.getGroundHeight(p.position.x, p.position.z, p.position.y);
    if (p.position.y <= ground + 0.01) {
      if (!p.onGround && p.velocity.y < -7.5) {
        this.effects.addShake(0.06);
        this.audio.play('land');
      }
      p.position.y = ground;
      p.velocity.y = 0;
      p.onGround = true;
      p.jumps = 0;
    } else {
      p.onGround = false;
    }
    if (p.position.y < -4) {
      p.position.copy(this.world.playerSpawn);
      p.velocity.set(0, 0, 0);
      this.damagePlayer(10, null, true);
    }

    // Jump pads.
    if (p.onGround) {
      const pad = this.world.checkJumpPads(p.position);
      if (pad) {
        p.velocity.y = 14.5;
        p.onGround = false;
        p.jumps = 1;
        this.audio.play('jump');
        this.effects.explosion(p.position.clone(), 1.2, pad.color);
        this.effects.addShake(0.05);
        this.ui.toast('BOOST PAD // YEET', 900);
      }
    }

    // Footsteps and bob.
    const planarSpeed = Math.hypot(p.velocity.x, p.velocity.z);
    this.playerSpeed = planarSpeed;
    if (p.onGround && planarSpeed > 1.2) {
      p.walkBob += dt * (6.5 + planarSpeed * 0.6);
      if (p.walkBob - this.lastStep > Math.PI) {
        this.lastStep = p.walkBob;
        this.audio.play('step', { volume: clamp(planarSpeed / 15, 0.1, 0.35) });
      }
    } else {
      p.walkBob = damp(p.walkBob, 0, 6, dt);
    }

    const movingAmt = clamp(planarSpeed / 7, 0, 1);
    const bob = p.onGround ? Math.sin(p.walkBob) * 0.026 * movingAmt + Math.sin(p.walkBob * 2) * 0.01 * movingAmt : 0;
    const eyeTarget = (1.68 - p.crouch * 0.55);
    p.eyeHeight = damp(p.eyeHeight, eyeTarget, 14, dt);

    // Camera.
    const shake = this.effects.shake;
    const shakeX = shake > 0.001 ? rand(-shake, shake) * 0.09 : 0;
    const shakeY = shake > 0.001 ? rand(-shake, shake) * 0.09 : 0;
    this.camera.position.set(p.position.x + shakeX, p.position.y + p.eyeHeight + bob + shakeY, p.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw + this.effects.kickYaw;
    this.camera.rotation.x = p.pitch + this.effects.kickPitch;
    this.camera.rotation.z = movingAmt * 0.007 + (this.ads ? 0 : Math.sin(p.walkBob * 0.5) * 0.003);
    const targetFov = this.ads ? (WEAPONS[this.currentWeapon].scope ? 15 : 54) : sprint ? 82 : 75;
    this.camera.fov = damp(this.camera.fov, targetFov, 9, dt);
    this.camera.updateProjectionMatrix();

    this.ui.speedLines(sprint && movingAmt > 0.3);
    this.ui.setSpread(7 + this.currentSpread() * 1300 + movingAmt * 3);

    // Shield regeneration.
    if (this.elapsed - p.lastDamage > 5 && p.armor < 100) {
      p.armor = Math.min(100, p.armor + 13 * dt);
    }
    if (this.overdrive > 0) this.overdrive -= dt;

    // Touch firing state.
    if (this.ui.mobile) {
      if (!this.ui.touch.fire) this.mouseDown = false;
    }
  }

  currentSpread() {
    const w = WEAPONS[this.currentWeapon];
    const moving = clamp(this.playerSpeed / 9, 0, 1);
    const crouch = this.player.crouch;
    return (w.spread + w.moveSpread * moving * (1 - crouch * 0.5)) * (this.ads ? 0.35 : 1);
  }

  updateWeapon(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.switchTimer = Math.max(0, this.switchTimer - dt);
    this.recoil = damp(this.recoil, 0, 10, dt);
    this.ads = !!this.mouseRight && !this.ui.mobile && !this.reloading;
    if (this.ads && !this.ui.isChatOpen()) {
      this.ui.setADS(true);
      if (WEAPONS[this.currentWeapon].scope) {
        this.ui.setScope(true);
        this.activeView.group.visible = false;
      } else {
        this.ui.setScope(false);
        this.activeView.group.visible = true;
      }
    } else {
      this.ui.setADS(false);
      this.ui.setScope(false);
      if (!this.ui.isChatOpen()) this.activeView.group.visible = true;
    }

    if (this.reloading) {
      this.reloadTimer += dt;
      const duration = WEAPONS[this.currentWeapon].reload * TEAM_CONFIG[this.team].reload;
      if (this.reloadTimer >= duration) {
        this.reloading = false;
        this.reloadTimer = 0;
        this.ammo[this.currentWeapon] = WEAPONS[this.currentWeapon].mag;
        this.audio.play('reloadDone');
        this.ui.toast('MAGAZINE SEALED', 700);
      }
    }

    const canFire = !this.reloading && this.switchTimer <= 0;
    if (canFire && this.fireCooldown <= 0 && !this.ui.isChatOpen() && (this.triggerPressed || (this.mouseDown && WEAPONS[this.currentWeapon].auto))) {
      this.tryFire();
    }
    this.triggerPressed = false;

    // Reload view model animation via state; ammo display.
    this.ui.setWeapon(this.currentWeapon, {
      mag: this.ammo[this.currentWeapon],
      reloading: this.reloading,
      reloadProgress: this.reloading ? clamp(this.reloadTimer / (WEAPONS[this.currentWeapon].reload * TEAM_CONFIG[this.team].reload), 0, 1) : 0,
    });
  }

  tryFire() {
    if (this.player.dead) return;
    const w = WEAPONS[this.currentWeapon];
    if (this.ammo[this.currentWeapon] <= 0) {
      this.audio.play('dry');
      this.startReload();
      return;
    }
    this.ammo[this.currentWeapon]--;
    this.fireCooldown = 60 / w.rpm;
    this.shots++;
    this.recoil = Math.min(3, this.recoil + w.kick);
    this.effects.kick(w.recoil * 0.55, rand(-w.recoil, w.recoil) * 0.5);
    this.effects.addShake(w.kick * 0.012);
    this.audio.play(w.sound);
    this.triggerPressed = false;

    const muzzleWorld = this.muzzleWorldPosition();
    this.effects.muzzle(muzzleWorld, w.color, w.id === 'shotgun' || w.id === 'rocket' ? 0.8 : 0.45);

    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    if (w.projectile) {
      this.spawnProjectile(w, origin, dir, muzzleWorld);
      if (w.id === 'rocket') this.effects.addShake(0.11);
    } else {
      let anyHit = false;
      let anyHead = false;
      const pellets = w.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const shotDir = dir.clone();
        const spread = this.currentSpread();
        if (spread > 0) {
          const rx = rand(-1, 1) * spread;
          const ry = rand(-1, 1) * spread;
          const right = new THREE.Vector3().crossVectors(shotDir, new THREE.Vector3(0, 1, 0)).normalize();
          const up = new THREE.Vector3().crossVectors(right, shotDir).normalize();
          shotDir.addScaledVector(right, rx).addScaledVector(up, ry).normalize();
        }
        this.raycaster.set(origin, shotDir);
        this.raycaster.far = w.range;
        const candidates = [];
        for (const e of this.enemies) {
          if (!e.alive) continue;
          for (const h of e.robot.hitMeshes) candidates.push(h);
        }
        const hits = this.raycaster.intersectObjects([...this.world.raycastMeshes, ...candidates], false);
        let end = origin.clone().addScaledVector(shotDir, w.range);
        if (hits.length) {
          const hit = hits[0];
          end = hit.point.clone();
          const enemy = hit.object.userData.enemy;
          if (enemy && enemy.alive) {
            const headshot = hit.object.userData.zone === 'head';
            if (headshot) anyHead = true;
            const base = w.damage * TEAM_CONFIG[this.team].damage * (this.overdrive > 0 ? 2 : 1);
            const dmg = base * (headshot ? 2.15 : 1) * (w.pellets ? rand(0.86, 1.08) : 1);
            enemy.takeDamage(dmg, { headshot, weapon: w.short, point: hit.point });
            anyHit = true;
            this.effects.hitSpark?.(hit.point);
            this.audio.play(headshot ? 'headshot' : 'hit');
            this.ui.hit(headshot);
          } else {
            const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
            this.effects.impact(hit.point, normal, w.color, w.id === 'shotgun' ? 1.4 : 0.8);
            this.audio.play('step', { volume: 0.1 });
          }
        }
        this.effects.tracer(muzzleWorld, end, w.id === 'plasma' ? 0x7bffd8 : 0xffdd91, 0.05, w.id === 'sniper' ? 0.035 : 0.016);
      }
      if (anyHit) {
        this.hits++;
        if (anyHead) this.headshots++;
      } else {
        // Slightly tighter feedback when shots miss.
      }
      if (w.id === 'sniper') this.effects.addShake(0.17);
    }

    if (this.ammo[this.currentWeapon] === 0) this.startReload();
  }

  spawnProjectile(w, origin, dir, muzzleWorld) {
    const group = new THREE.Group();
    let mesh;
    if (w.projectile === 'rocket') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.55, 8), new THREE.MeshStandardMaterial({ color: 0x303b47, metalness: 0.7, roughness: 0.3 }));
      body.rotation.x = Math.PI / 2;
      group.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), new THREE.MeshBasicMaterial({ color: w.color, transparent: true, opacity: 0.95 }));
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -0.38;
      group.add(tip);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xff8a37, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.rotation.x = Math.PI / 2;
      flame.position.z = 0.45;
      group.add(flame);
      mesh = group;
    } else {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7dffcc }));
      group.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: createGlowTexture('#62ffd1'), color: 0x38ffb0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(0.8);
      group.add(glow);
      mesh = group;
    }
    const startPos = origin.clone().addScaledVector(dir, 0.7);
    group.position.copy(startPos);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    this.scene.add(group);
    const light = new THREE.PointLight(w.color, 8, 5, 2);
    group.add(light);
    this.projectiles.push({
      group, mesh: group, position: startPos.clone(), prev: startPos.clone(),
      velocity: dir.clone().multiplyScalar(w.projectileSpeed),
      owner: 'player', type: w.projectile, damage: w.damage * TEAM_CONFIG[this.team].damage * (this.overdrive > 0 ? 2 : 1),
      splash: w.splash, splashDamage: w.splashDamage, life: 4.2, trail: 0, color: w.color,
      weapon: w.short,
    });
    this.audio.play(w.id === 'rocket' ? 'rocket' : 'plasma');
  }

  muzzleWorldPosition() {
    const local = new THREE.Vector3();
    if (this.activeView) this.activeView.muzzle.getWorldPosition(local);
    this.camera.updateMatrixWorld();
    local.applyMatrix4(this.camera.matrixWorld);
    return local;
  }

  startReload() {
    if (this.reloading || this.state !== 'playing') return;
    const w = WEAPONS[this.currentWeapon];
    if (this.ammo[this.currentWeapon] >= w.mag) return;
    this.reloading = true;
    this.reloadTimer = 0;
    this.ads = false;
    this.mouseRight = false;
    this.ui.setScope(false);
    this.audio.play('reload');
  }

  switchWeapon(index) {
    if (index === this.currentWeapon || index < 0 || index >= WEAPONS.length) return;
    this.currentWeapon = index;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0.15;
    this.switchTimer = 0.28;
    this.ads = false;
    this.ui.setScope(false);
    for (const v of this.weaponViews) v.group.visible = false;
    this.activeView = this.weaponViews[index];
    this.activeView.group.visible = true;
    this.activeView.group.position.set(...this.activeView.config.viewPos);
    this.ui.setWeapon(index, { mag: this.ammo[index], reloading: false, reloadProgress: 0 });
    this.audio.play('switch');
  }

  updateViewmodel(dt) {
    if (!this.activeView) return;
    const v = this.activeView;
    v.group.visible = !((this.ads && WEAPONS[this.currentWeapon].scope) || this.ui.isChatOpen() || this.state === 'menu');
    if (!v.group.visible) return;
    v.inner.position.set(0, 0, 0);
    v.inner.rotation.set(0, 0, 0);
    const base = v.basePos;
    const bob = this.player.walkBob;
    const moving = clamp(this.playerSpeed / 7, 0, 1);
    const sprint = !!((this.keys.ShiftLeft || this.keys.ShiftRight) && this.playerSpeed > 5.5 && this.player.onGround);
    const adsK = this.ads ? 1 : 0;
    this.adsLerp = damp(this.adsLerp, adsK, 12, dt);

    const reloadK = this.reloading ? Math.sin(clamp(this.reloadTimer / (WEAPONS[this.currentWeapon].reload * TEAM_CONFIG[this.team].reload), 0, 1) * Math.PI) : 0;
    const switchK = this.switchTimer > 0 ? this.switchTimer / 0.28 : 0;
    const recoilK = this.recoil;

    const targetX = base.x + Math.cos(bob) * 0.011 * moving + this.sway.x - this.adsLerp * 0.31;
    const targetY = base.y + Math.abs(Math.sin(bob)) * 0.014 * moving + this.sway.y - reloadK * 0.33 - switchK * 0.42 - sprint * 0.035 + Math.sin(this.time * 1.4) * 0.003;
    const targetZ = base.z + recoilK * 0.035 + (sprint ? 0.06 : 0) + this.adsLerp * 0.12;
    v.group.position.x = damp(v.group.position.x, targetX, 18, dt);
    v.group.position.y = damp(v.group.position.y, targetY, 18, dt);
    v.group.position.z = damp(v.group.position.z, targetZ, 18, dt);
    v.group.rotation.x = damp(v.group.rotation.x, v.config.viewRot[0] + recoilK * 0.09 + reloadK * 0.45 + switchK * 0.6 - this.adsLerp * 0.015, 16, dt);
    v.group.rotation.y = damp(v.group.rotation.y, v.config.viewRot[1] + this.sway.x * 2, 16, dt);
    v.group.rotation.z = damp(v.group.rotation.z, v.config.viewRot[2] + reloadK * 0.55 + switchK * 0.35 + Math.cos(bob) * 0.003 * moving - sprint * 0.14 + this.adsLerp * 0.04, 16, dt);
    v.inner.rotation.z = Math.sin(this.time * 1.1) * 0.004;
    if (v.built.slide) v.built.slide.position.z = -0.25 + Math.min(recoilK, 1.6) * 0.012;
    if (v.built.pump) v.built.pump.position.z = -0.55 + (reloadK > 0 ? Math.sin(clamp(this.reloadTimer / 1.8, 0, 1) * TAU) * 0.1 : 0);
    if (v.built.bolt) v.built.bolt.position.z = -0.08 + Math.sin(reloadK * Math.PI) * 0.14;
    if (v.built.rocket) v.built.rocket.visible = this.ammo[this.currentWeapon] > 0;
    v.light.intensity = 0.35 + Math.sin(this.time * 3) * 0.1;
    this.sway.x = damp(this.sway.x, 0, 9, dt);
    this.sway.y = damp(this.sway.y, 0, 9, dt);
  }

  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt);
    }
    this.ui.setBots(this.enemies.filter((e) => !e.dying).length);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) { this.removeProjectile(p, i); continue; }
      p.prev.copy(p.position);
      p.position.addScaledVector(p.velocity, dt);
      p.group.position.copy(p.position);
      p.trail -= dt;
      if (p.trail <= 0) {
        p.trail = p.type === 'rocket' ? 0.025 : 0.05;
        this.effects.tracer(p.prev.clone(), p.position.clone(), p.type === 'rocket' ? 0xff8a4a : 0x64ffd0, 0.14, p.type === 'rocket' ? 0.035 : 0.02);
        if (p.type === 'rocket') this.effects.smoke(p.position.clone(), new THREE.Vector3(0, 1, 0), 1);
      }
      const step = p.position.clone().sub(p.prev);
      const len = step.length();
      if (len > 0.001) {
        this.raycaster.set(p.prev, step.clone().normalize());
        this.raycaster.far = len;
        const hits = this.raycaster.intersectObjects(this.world.raycastMeshes, false);
        if (hits.length) {
          this.detonateProjectile(p, hits[0].point.clone(), i);
          continue;
        }
      }
      if (p.owner === 'player') {
        let hitEnemy = null;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const c = e.center;
          if (p.position.distanceTo(c) < (e.isBoss ? 1.5 : 0.8) + p.splash * 0.1) { hitEnemy = e; break; }
        }
        if (hitEnemy) { this.detonateProjectile(p, p.position.clone(), i); continue; }
      } else if (p.owner === 'enemy') {
        const target = new THREE.Vector3(this.player.position.x, this.player.position.y + 1.1, this.player.position.z);
        if (p.position.distanceTo(target) < 1.0) {
          this.detonateProjectile(p, p.position.clone(), i);
          continue;
        }
      }
      if (p.position.y < -2) { this.detonateProjectile(p, p.position.clone(), i); }
    }
  }

  detonateProjectile(p, point, index) {
    const isRocket = p.type === 'rocket';
    this.effects.explosion(point, isRocket ? p.splash : 0.8, p.color);
    this.audio.play('explosion', { volume: isRocket ? 0.8 : 0.35 });
    this.effects.addShake(isRocket ? 0.2 : 0.04);
    if (p.owner === 'player') {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const c = e.center;
        const dist = c.distanceTo(point);
        if (dist < p.splash) {
          const falloff = 1 - dist / p.splash;
          const dmg = (p.splashDamage || p.damage) * (0.4 + falloff * 0.6);
          e.takeDamage(dmg, { weapon: p.weapon, point: c });
        }
      }
      const selfDist = new THREE.Vector3(this.player.position.x, this.player.position.y + 0.9, this.player.position.z).distanceTo(point);
      if (selfDist < p.splash * 1.15) {
        const falloff = 1 - selfDist / (p.splash * 1.15);
        this.damagePlayer((p.splashDamage || p.damage) * 0.2 * falloff, null);
        // Give rockets a little upward kick: useful, reckless, correct.
        const away = new THREE.Vector3(this.player.position.x, 0, this.player.position.z).sub(point);
        away.y = 0;
        if (away.lengthSq() > 0.001) away.normalize();
        this.player.velocity.x += away.x * 8 * falloff;
        this.player.velocity.z += away.z * 8 * falloff;
        this.player.velocity.y += 8 * falloff;
        this.player.onGround = false;
      }
    } else {
      const target = new THREE.Vector3(this.player.position.x, this.player.position.y + 0.9, this.player.position.z);
      const dist = target.distanceTo(point);
      if (dist < p.splash * 1.2) {
        const falloff = 1 - dist / (p.splash * 1.2);
        this.damagePlayer((p.splashDamage || p.damage) * (0.4 + falloff), null);
      }
    }
    const idx = this.projectiles.indexOf(p);
    if (idx >= 0) {
      this.scene.remove(p.group);
      p.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
      this.projectiles.splice(idx, 1);
    }
  }

  removeProjectile(p, index) {
    this.scene.remove(p.group);
    p.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    this.projectiles.splice(index, 1);
  }

  updateWave(dt) {
    if (this.waveState === 'spawning') {
      this.waveSpawnTimer -= dt;
      let pending = this.waveQueue.filter((q) => !q.spawned);
      for (const q of pending) {
        if (q.delay <= 0) {
          q.spawned = true;
          this.spawnWaveEnemy(q);
        }
      }
      for (const q of this.waveQueue) q.delay -= dt;
      if (this.waveQueue.every((q) => q.spawned)) this.waveState = 'fighting';
      this.ui.setBots(this.enemies.filter((e) => !e.dying).length + this.waveQueue.filter((q) => !q.spawned).length);
    } else if (this.waveState === 'fighting') {
      const alive = this.enemies.filter((e) => e.alive);
      if (alive.length === 0 && this.waveQueue.every((q) => q.spawned)) this.waveCleared();
    } else if (this.waveState === 'between') {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        this.startWave(this.wave + 1);
      }
    }
  }

  waveCleared() {
    this.waveState = 'clear';
    this.combo = 0;
    const bonus = 500 * this.wave;
    this.score += bonus;
    this.audio.play('wave');
    this.ui.toast(`WAVE CLEAR // +${bonus}`, 2400);
    this.ui.chat('ARENA', `Wave ${String(this.wave).padStart(2, '0')} cleared. +${bonus} points.`, 'system');
    for (let i = 0; i < 2; i++) {
      const pos = this.world.spawnPoints[randInt(0, this.world.spawnPoints.length - 1)].clone();
      pos.y = this.world.getGroundHeight(pos.x, pos.z, 0.2);
      this.spawnPickup(i === 0 ? 'health' : 'armor', pos);
    }
    if (this.wave >= 3) {
      this.world.setPortalActive(true);
      this.waveState = 'portal';
      this.ui.waveBanner('PORTAL ONLINE', 'THE WAY TO VENUS IS OPEN', 'SIGNAL');
      this.ui.objective.textContent = 'ENTER THE VENUS PORTAL // PRESS E';
      this.ui.showPrompt('ENTER VENUS PORTAL');
      this.ui.chat('RIVET', 'portal’s lit. i am not going first.', 'red');
      this.audio.play('portal');
    } else {
      this.waveState = 'between';
      this.waveDelay = 4.2;
      this.ui.waveBanner('WAVE CLEAR', `NEXT CONTACT IN ${Math.ceil(this.waveDelay)} SECONDS`, 'BREATHER');
    }
  }

  tryPortal() {
    if (this.state !== 'playing' || this.waveState !== 'portal' || !this.world.portal) return;
    const d = Math.hypot(this.player.position.x - this.world.portal.x, this.player.position.z - this.world.portal.z);
    if (d < 4.3) this.beginVenusTransition();
    else this.ui.toast('PORTAL OUT OF RANGE', 1000);
  }

  beginVenusTransition() {
    if (this.state !== 'playing') return;
    this.state = 'transition';
    this.transition = { t: 0, swapped: false };
    this.ui.showPrompt(null);
    this.ui.setFade(1, 1.1);
    this.ui.setScope(false);
    this.ui.setBoss(false);
    this.audio.play('portal');
    this.audio.setMusicMode('boss');
    this.player.velocity.set(0, 0, 0);
    this.ui.toast('TRANSIT // VENUS', 1800);
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.time += dt;
      p.group.rotation.y += dt * 1.8;
      p.group.position.y = p.baseY + Math.sin(p.time * 2.4) * 0.12;
      p.light.intensity = 6 + Math.sin(p.time * 4) * 3;
      p.glow.material.opacity = 0.55 + Math.sin(p.time * 4) * 0.15;
      const d = Math.hypot(this.player.position.x - p.group.position.x, this.player.position.z - p.group.position.z);
      if (d < 1.28 && Math.abs(this.player.position.y + 0.8 - p.group.position.y) < 2.2) {
        this.collectPickup(p);
        this.scene.remove(p.group);
        p.group.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
          }
        });
        this.pickups.splice(i, 1);
      }
    }
  }

  spawnPickup(type, pos) {
    const group = new THREE.Group();
    const color = type === 'health' ? 0x64ffb4 : type === 'armor' ? 0x5ab4ff : 0xffb347;
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.3 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat);
    core.position.y = 0.75;
    group.add(core);
    if (type === 'health') {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.14), mat);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), mat);
      h.position.y = 0.75; v.position.y = 0.75;
      group.add(h, v);
    } else if (type === 'armor') {
      const shield = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 6), mat);
      shield.position.y = 0.75;
      shield.rotation.x = Math.PI / 2;
      group.add(shield);
    } else {
      const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), mat);
      bolt.position.y = 0.8;
      group.add(bolt);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: createGlowTexture(type === 'health' ? '#56ffa8' : type === 'armor' ? '#4da6ff' : '#ffae42'), color, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.8);
    glow.position.y = 0.75;
    group.add(glow);
    const light = new THREE.PointLight(color, 7, 5, 2);
    light.position.y = 0.8;
    group.add(light);
    group.position.set(pos.x, this.world.getGroundHeight(pos.x, pos.z, 0.2), pos.z);
    this.scene.add(group);
    this.pickups.push({ type, group, baseY: group.position.y, time: 0, light, glow, color });
  }

  collectPickup(p) {
    if (p.type === 'health') {
      this.player.health = Math.min(100, this.player.health + 35);
      this.ui.toast('HULL REPAIRED +35', 1300);
    } else if (p.type === 'armor') {
      this.player.armor = Math.min(100, this.player.armor + 45);
      this.ui.toast('SHIELD PLATING +45', 1300);
    } else {
      this.overdrive = 12;
      this.ui.toast('OVERDRIVE // DOUBLE DAMAGE 12s', 1800);
    }
    this.audio.play('pickup');
    this.effects.flashSprite(p.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)), p.color, 1.3, 0.3, 2);
    this.effects.spawnSpark(p.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(0, 1, 0), p.color, 14, 4, 1, -3);
  }

  onEnemyKilled(enemy, headshot, weapon) {
    const w = WEAPON_BY_SHORT[weapon] || weapon;
    this.kills++;
    const now = this.elapsed;
    if (now - this.lastKillAt < 3.2) this.combo++;
    else this.combo = 1;
    this.lastKillAt = now;
    const mult = 1 + Math.max(0, this.combo - 1) * 0.25;
    const gain = Math.round(enemy.type.score * mult * (headshot ? 1.25 : 1));
    this.score += gain;
    this.ui.feed('YOU', enemy.name, weapon, this.team, enemy.team, true);
    if (this.combo === 2) this.ui.medal('DOUBLE KILL');
    else if (this.combo === 3) this.ui.medal('TRIPLE KILL');
    else if (this.combo >= 4) this.ui.medal('MASSACRE');
    if (headshot) this.ui.medal('HEADSHOT // +25%');
    if (enemy.isBoss) {
      this.ui.setBoss(false);
      this.waveState = 'clear';
      this.score += 2500;
      this.state = 'won';
      this.endTimer = 0;
      this.ui.setScope(false);
      this.ui.showPrompt(null);
      this.ui.showBoss?.(false);
      this.audio.play('victory');
      this.audio.setMusicMode('menu');
      this.effects.explosion(enemy.center, 10, 0xff5c2e);
      this.ui.chat('ARENA', 'PRIME UNIT DESTROYED. VENUS SECTOR SECURE.', 'system');
    } else {
      const dropChance = Math.random();
      if (dropChance < 0.22) this.spawnPickup('health', enemy.root.position.clone());
      else if (dropChance < 0.38) this.spawnPickup('armor', enemy.root.position.clone());
      else if (dropChance < 0.44) this.spawnPickup('overdrive', enemy.root.position.clone());
      if (this.combo >= 2) this.ui.toast(`${this.combo}× COMBO // +${gain}`, 1200);
      this.ui.setBoss(this.enemies.some((e) => e.isBoss && e.alive), 'THE VENUS WARDEN', this.bossHealthPct());
    }
    if (!enemy.isBoss) {
      const bot = pick(BOT_CHATTER.playerKill);
      if (Math.random() < 0.42) setTimeout(() => this.botSays(this.randomBotName(), bot), rand(600, 1800));
    }
    this.ui.setBoss(this.enemies.some((e) => e.isBoss && e.alive), 'THE VENUS WARDEN', this.bossHealthPct());
  }

  bossHealthPct() {
    const boss = this.enemies.find((e) => e.isBoss && e.alive);
    return boss ? boss.health / boss.maxHealth : 0;
  }

  randomBotName() {
    const alive = this.enemies.filter((e) => e.alive && !e.isBoss);
    if (alive.length) return pick(alive).name;
    return pick(ENEMY_NAMES);
  }

  botSays(name, text, team = this.team === 'red' ? 'blue' : 'red') {
    this.ui.chat(name, text, team);
  }

  damagePlayer(amount, source, force = false) {
    if (this.player.dead || this.state !== 'playing') return;
    if (!force && this.transition) return;
    const p = this.player;
    p.lastDamage = this.elapsed;
    let dmg = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, dmg * 0.7);
      p.armor -= absorbed;
      dmg -= absorbed;
    }
    p.health -= dmg;
    this.ui.damage(clamp(amount / 30, 0.2, 1.3));
    this.effects.addShake(clamp(amount / 150, 0.02, 0.2));
    this.audio.play('hurt', { volume: 0.7 });
    if (source) {
      const d = new THREE.Vector3(source.root.position.x, this.player.position.y, source.root.position.z);
      this.effects.flashSprite(d.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xff4f4f, 0.28, 0.15, 1);
    }
    if (p.health <= 0) this.killPlayer(source);
  }

  killPlayer(source) {
    if (this.player.dead) return;
    this.player.dead = true;
    this.player.health = 0;
    this.state = 'dead';
    this.deathTimer = 0;
    this.audio.play('defeat');
    this.audio.setMusicMode('menu');
    this.ui.setScope(false);
    this.ui.showPrompt(null);
    this.ui.setBoss(false);
    this.ui.feed(source ? source.name : 'THE ARENA', 'YOU', 'SCENERY', source ? source.team : 'red', this.team, false);
    this.ui.chat('ARENA', 'Operator down. Signal lost.', 'system');
  }

  updateDeathCamera(dt) {
    const p = this.player;
    p.pitch = damp(p.pitch, -0.4, 3, dt);
    this.camera.position.set(p.position.x, damp(this.camera.position.y, p.position.y + 0.35, 3, dt), p.position.z);
    this.camera.rotation.set(p.pitch, p.yaw, Math.sin(this.deathTimer * 2) * 0.05);
    this.camera.fov = damp(this.camera.fov, 70, 2, dt);
    this.camera.updateProjectionMatrix();
  }

  updateVictoryCamera(dt) {
    this.camera.fov = damp(this.camera.fov, 62, 2, dt);
    this.camera.updateProjectionMatrix();
    this.camera.position.y = damp(this.camera.position.y, this.player.position.y + 2.4 + Math.sin(this.endTimer * 0.7) * 0.2, 1.2, dt);
    this.camera.rotation.z = damp(this.camera.rotation.z, Math.sin(this.endTimer * 0.5) * 0.04, 1.5, dt);
  }

  showEnd(victory) {
    // Release the mouse before showing the results screen, otherwise a locked
    // pointer keeps routing clicks to the canvas instead of the modal buttons.
    if (document.pointerLockElement) document.exitPointerLock();
    const accuracy = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 0;
    const record = !victory ? false : false;
    const high = this.score > this.ui.highScore;
    this.ui.showGameOver({
      victory,
      stats: { score: this.score, kills: this.kills, accuracy, time: this.runTime },
      record: high,
    });
    if (high) this.ui.highScore = this.score;
  }

  updateHUD(dt) {
    this.ui.setHUD({
      score: this.score,
      kills: this.kills,
      waveLabel: `${String(this.wave).padStart(2, '0')}/04`,
      health: this.player.health,
      armor: this.player.armor,
      objective: this.waveState === 'portal' ? 'ENTER THE VENUS PORTAL // PRESS E' : WAVE_DEFS[this.wave]?.objective,
    });
    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.08;
      this.ui.updateMinimap({
        player: { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw },
        enemies: this.enemies.filter((e) => e.alive).map((e) => ({ x: e.root.position.x, z: e.root.position.z, boss: e.isBoss })),
        pickups: this.pickups.map((p) => ({ x: p.group.position.x, z: p.group.position.z })),
        buildings: this.world.mapPoints.filter((m) => m.kind === 'building'),
        portal: this.world.portal ? { x: this.world.portal.x, z: this.world.portal.z, active: this.world.portal.active } : null,
        time: this.time,
      });
      this.ui.setBots(this.enemies.filter((e) => e.alive).length);
    }
    if (this.waveState === 'portal') {
      const d = Math.hypot(this.player.position.x - this.world.portal.x, this.player.position.z - this.world.portal.z);
      this.ui.showPrompt(d < 4.3 ? 'ENTER VENUS PORTAL' : null);
    } else {
      this.ui.showPrompt(null);
    }
    if (this.wave === 4) this.ui.setBoss(this.enemies.some((e) => e.isBoss && e.alive), 'THE VENUS WARDEN', this.bossHealthPct());
    if (this.player.health < 30 && this.elapsed % 7 < 0.02) this.ui.chat('RIVET', pick(BOT_CHATTER.low), 'red');
  }

  updateScoreCombo(dt) {
    if (this.combo > 0 && this.elapsed - this.lastKillAt > 3.4) this.combo = 0;
  }

  updatePings(dt) {
    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.pingTimer = rand(2.5, 5);
      this.ui.setPing(randInt(11, 34));
    }
  }

  updateChat(dt) {
    this.chatTimer -= dt;
    if (this.chatTimer > 0) return;
    if (this.waveState === 'portal') {
      this.chatTimer = rand(11, 18);
      this.ui.chat('MAGENTA', pick(BOT_CHATTER.venus), 'red');
      return;
    }
    if (this.enemies.some((e) => e.alive)) {
      this.chatTimer = rand(12, 24);
      const name = this.randomBotName();
      if (name === 'THE VENUS WARDEN') return;
      const roll = Math.random();
      const line = roll < 0.55 ? pick(BOT_CHATTER.start) : roll < 0.8 ? pick(BOT_CHATTER.kill) : pick(BOT_CHATTER.wave);
      this.botSays(name, line);
    } else {
      this.chatTimer = 8;
    }
  }

  sendPlayerChat(text) {
    this.ui.chat('YOU', text, this.team, true);
    const lower = text.toLowerCase();
    let reply;
    if (/hi|hello|hey|yo\b/.test(lower)) reply = pick(['hello, new unit.', 'greetings. please do not shoot me. i am very expensive.', 'hey. nice chassis.']);
    else if (/venus|portal/.test(lower)) reply = pick(['venus is where the sky catches fire. bring a coat.', 'the portal is real. the warden is not happy.', 'i have seen venus. it has opinions.']);
    else if (/noob|trash|bad|easy/.test(lower)) reply = pick(['big talk from someone still on the tutorial map.', 'i have died 4,000 times. i am basically an expert.', 'keep talking, shiny.']);
    else if (/gg|good game/.test(lower)) reply = pick(['gg. mostly for me.', 'good game, robot.', 'rematch in the next life.']);
    else if (/fly|rocket jump/.test(lower)) reply = pick(['aim down, fire rocket, become aviation. simple.', 'the RPG is a movement tool if you believe hard enough.', 'gravity is a suggestion.']);
    else reply = pick(BOT_CHATTER.reply);
    setTimeout(() => {
      const alive = this.enemies.filter((e) => e.alive && !e.isBoss);
      const name = alive.length ? pick(alive).name : pick(['BOLT-9', 'RIVET', 'MAGENTA']);
      this.botSays(name, reply);
    }, rand(700, 1700));
  }

  summonBossAdds(boss) {
    this.ui.toast('WARDEN DEPLOYING ESCORTS', 1600);
    this.ui.chat('THE VENUS WARDEN', 'You brought a rifle to a god fight.', 'red');
    this.audio.play('boss', { volume: 0.6 });
    const positions = [
      boss.root.position.clone().add(new THREE.Vector3(-5, 0, 3)),
      boss.root.position.clone().add(new THREE.Vector3(5, 0, 3)),
    ];
    for (let i = 0; i < 2; i++) {
      const type = i === 0 ? 'scout' : 'trooper';
      const p = positions[i];
      p.y = this.world.getGroundHeight(p.x, p.z, 0.2);
      const e = new Enemy(this, type, p, i === 0 ? 'CINDER' : 'SOLDER', this.team === 'red' ? 'blue' : 'red');
      this.enemies.push(e);
      this.effects.explosion(p.clone().add(new THREE.Vector3(0, 1, 0)), 2, 0xff5c2e);
    }
  }

  hasLineOfSight(from, to) {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 0.01) return true;
    this.raycaster.set(from, dir.normalize());
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.world.raycastMeshes, false);
    return hits.length === 0 || hits[0].distance >= dist - 0.3;
  }

  worldRaycast(from, dir, dist) {
    this.raycaster.set(from, dir.clone().normalize());
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.world.raycastMeshes, false);
    return hits.length > 0;
  }

  clearEnemies() {
    for (const e of this.enemies) {
      this.scene.remove(e.root);
      if (e.laser) { this.scene.remove(e.laser); e.laser.geometry.dispose(); e.laser.material.dispose(); }
      e.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
        }
      });
    }
    this.enemies = [];
    this.ui.setBots(0);
  }

  clearProjectiles() {
    for (const p of this.projectiles) this.scene.remove(p.group);
    this.projectiles = [];
  }

  clearPickups() {
    for (const p of this.pickups) this.scene.remove(p.group);
    this.pickups = [];
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    if (this.ui.isChatOpen()) return;
    this.state = 'paused';
    this.ui.showPause(true, {
      score: this.score, wave: this.wave,
      accuracy: this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 0,
    });
    this.ui.resetTouchLook();
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.setMusicMode('menu');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.ui.showPause(false);
    this.ui.hidePause();
    this.state = 'playing';
    this.audio.setMusicMode(this.wave === 4 ? 'boss' : 'combat');
    this.requestPointerLock();
  }

  quitToMenu() {
    this.state = 'menu';
    this.ui.showMenu();
    this.ui.setBoss(false);
    this.ui.setSector('CITYSCAPE');
    this.audio.setMusicMode('menu');
    if (document.pointerLockElement) document.exitPointerLock();
    this.clearEnemies();
    this.clearProjectiles();
    this.clearPickups();
    this.effects.reset();
    this.setupMenuScene();
  }

  retry() {
    this.ui.hideGameOver();
    this.clearEnemies();
    this.clearProjectiles();
    this.clearPickups();
    if (this.world.envType !== 'city') {
      this.world.disposeLights();
      this.world.buildCity();
    }
    this.state = 'playing';
    this.ui.showHUD();
    this.ui.setBoss(false);
    this.ui.setSector('CITYSCAPE');
    this.audio.setMusicMode('combat');
    this.resetRun();
    this.requestPointerLock();
  }

  render() {
    this.composer.render();
    if (this.state !== 'menu') {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.view.scene, this.view.camera);
      this.renderer.autoClear = true;
    }
  }

  resize(w, h) {
    this.viewport.w = w;
    this.viewport.h = h;
    const aspect = w / h;
    const portrait = aspect < 0.85;
    this.view.camera.aspect = aspect;
    this.view.camera.fov = portrait ? 72 : 55;
    this.view.camera.updateProjectionMatrix();
    this.viewRig.position.x = portrait ? -0.12 : 0;
    this.viewRig.position.y = portrait ? 0.02 : 0;
    this.viewRig.scale.setScalar(portrait ? 0.68 : 1);
  }
}

const WEAPON_BY_SHORT = Object.fromEntries(WEAPONS.map((w) => [w.short, w.id]));
