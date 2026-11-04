import * as THREE from 'three';
import { mulberry32, rand, TAU, makeCanvasTexture, createTextTexture, createGlowTexture } from './util.js';

const CITY_SKY = {
  top: new THREE.Color(0x07162e),
  mid: new THREE.Color(0x174d72),
  horizon: new THREE.Color(0xff9366),
  sun: new THREE.Color(0xffd08a),
  fog: 0x19364d,
};

const VENUS_SKY = {
  top: new THREE.Color(0x1a0524),
  mid: new THREE.Color(0x631a4a),
  horizon: new THREE.Color(0xff6c37),
  sun: new THREE.Color(0xffc06a),
  fog: 0x4a1731,
};

function makeWindowTexture(seed, base = '#101f33', lit = ['#54d7ff', '#ffcf7a', '#ff7bd5', '#8eecff']) {
  const rnd = mulberry32(seed);
  return makeCanvasTexture(192, 384, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cols = 5;
    const rows = 12;
    const padX = 10;
    const padY = 10;
    const cw = (w - padX * 2) / cols;
    const ch = (h - padY * 2) / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const isLit = rnd() > 0.38;
        ctx.fillStyle = isLit ? lit[Math.floor(rnd() * lit.length)] : '#0a1421';
        ctx.globalAlpha = isLit ? 0.55 + rnd() * 0.45 : 0.9;
        ctx.fillRect(padX + x * cw + 4, padY + y * ch + 4, cw - 8, ch - 8);
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(padX + x * cw, 0);
      ctx.lineTo(padX + x * cw, h);
      ctx.stroke();
    }
  });
}

function makeGroundTexture(kind = 'city') {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    if (kind === 'city') {
      ctx.fillStyle = '#172c40';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#234b69';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 16; i++) {
        const p = (i / 16) * w;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
      }
      const rnd = mulberry32(4);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(70,230,255,0.1)' : 'rgba(255,170,90,0.08)';
        ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 20, 2);
      }
    } else {
      ctx.fillStyle = '#321627';
      ctx.fillRect(0, 0, w, h);
      const rnd = mulberry32(12);
      for (let i = 0; i < 28; i++) {
        ctx.strokeStyle = `rgba(${120 + rnd() * 80},${30 + rnd() * 30},${20 + rnd() * 20},0.4)`;
        ctx.lineWidth = 1 + rnd() * 3;
        ctx.beginPath();
        let x = rnd() * w;
        let y = rnd() * h;
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          x += (rnd() - 0.5) * 100;
          y += (rnd() - 0.5) * 100;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(255,${90 + rnd() * 80},40,${0.1 + rnd() * 0.2})`;
        ctx.beginPath();
        ctx.arc(rnd() * w, rnd() * h, 10 + rnd() * 35, 0, TAU);
        ctx.fill();
      }
    }
  });
}

function makeSkyMaterial(colors, sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: colors.top },
      midColor: { value: colors.mid },
      horizonColor: { value: colors.horizon },
      sunColor: { value: colors.sun },
      sunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = clamp(dir.y, -0.1, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(-0.02, 0.42, h));
        col = mix(col, topColor, smoothstep(0.35, 0.95, h));
        float sun = pow(max(dot(dir, normalize(sunDir)), 0.0), 380.0);
        float halo = pow(max(dot(dir, normalize(sunDir)), 0.0), 12.0);
        col += sunColor * sun * 2.4 + sunColor * halo * 0.22;
        float haze = smoothstep(0.0, 0.11, abs(h)) * (1.0 - smoothstep(0.02, 0.3, h));
        col += horizonColor * haze * 0.2;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.solids = [];
    this.raycastMeshes = [];
    this.jumpPads = [];
    this.spawnPoints = [];
    this.playerSpawn = new THREE.Vector3(0, 0, 26);
    this.portal = null;
    this.portalActive = false;
    this.envType = 'city';
    this.time = 0;
    this.cars = [];
    this.floaters = [];
    this.particles = [];
    this.billboardMats = [];
    this.beacons = [];
    this.mapPoints = [];
    this.projectiles = [];
    this.movingPlatforms = [];
    this.windLines = null;
    this.sunLight = null;
    this.ambientParticles = null;
  }

  clear() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
    this.group = null;
    this.solids = [];
    this.raycastMeshes = [];
    this.jumpPads = [];
    this.spawnPoints = [];
    this.cars = [];
    this.floaters = [];
    this.particles = [];
    this.billboardMats = [];
    this.beacons = [];
    this.mapPoints = [];
    this.portal = null;
  }

  initEnv() {
    this.group = new THREE.Group();
    this.group.name = 'environment';
    this.scene.add(this.group);
    this.time = 0;
  }

  addSolid(minX, minY, minZ, maxX, maxY, maxZ, { standable = true, tag = '' } = {}) {
    this.solids.push({ minX, minY, minZ, maxX, maxY, maxZ, standable, tag });
  }

  registerMesh(mesh, { shadow = true, receive = true } = {}) {
    mesh.castShadow = shadow;
    mesh.receiveShadow = receive;
    this.group.add(mesh);
    this.raycastMeshes.push(mesh);
    return mesh;
  }

  buildCity() {
    this.clear();
    this.envType = 'city';
    this.initEnv();
    this.scene.fog = new THREE.FogExp2(CITY_SKY.fog, 0.0105);
    this.scene.background = new THREE.Color(CITY_SKY.fog);

    const sunDir = new THREE.Vector3(-0.45, 0.42, -0.8).normalize();
    this.buildSky(CITY_SKY, sunDir);
    this.buildLights(sunDir, 'city');

    // Main plaza.
    const groundTex = makeGroundTexture('city');
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(10, 10);
    const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, color: 0x8ca9c0, roughness: 0.88, metalness: 0.18, emissive: 0x07111c, emissiveIntensity: 0.6 });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(96, 1.2, 96), groundMat);
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    this.group.add(ground);
    this.raycastMeshes.push(ground);

    // Raised central plaza + inset lanes.
    this.addDecalStrip(0, 0.012, 0, 54, 0.06, 54, 0x0c233c);
    this.addGlowStrip(0, 0.02, 0, 50, 0.035, 0.12, 0x2dd9ff, 0.75, 0);
    this.addGlowStrip(0, 0.02, 0, 0.12, 0.035, 50, 0x2dd9ff, 0.75, 0);
    this.addGlowStrip(0, 0.022, 0, 34, 0.025, 0.07, 0xffb347, 0.55, 0);
    this.addGlowStrip(0, 0.022, 0, 0.07, 0.025, 34, 0xffb347, 0.55, 0);

    // Outer ring of skyscrapers.
    const windowTextures = [
      makeWindowTexture(3, '#0a1b30'),
      makeWindowTexture(17, '#15172c'),
      makeWindowTexture(29, '#211b2f'),
      makeWindowTexture(41, '#0d2231'),
    ];
    const accentColors = [0xffb24a, 0x34e6ff, 0xff5ba9, 0x9dff8b, 0xff6e49];
    const rnd = mulberry32(2026);
    const outer = [
      [-38, -32, 12, 12, 25], [-25, -40, 11, 10, 31], [-8, -42, 9, 12, 22],
      [10, -41, 13, 12, 29], [28, -37, 9, 9, 19], [40, -25, 11, 13, 34],
      [43, -7, 10, 9, 23], [42, 12, 12, 14, 30], [35, 31, 11, 11, 24],
      [18, 40, 14, 10, 33], [-2, 42, 10, 12, 21], [-20, 40, 12, 10, 28],
      [-38, 32, 12, 13, 35], [-43, 13, 11, 9, 22], [-44, -8, 12, 14, 28],
      [-44, 25, 8, 9, 16],
    ];
    for (let i = 0; i < outer.length; i++) {
      const [x, z, w, d, h] = outer[i];
      const tex = windowTextures[i % windowTextures.length];
      this.buildBuilding(x, z, w, d, h, {
        tex, accent: accentColors[i % accentColors.length], rotation: (rnd() - 0.5) * 0.06,
        roof: h > 24,
      });
    }

    // Mid-field buildings that create lanes and cover.
    const mid = [
      [-23, -16, 9, 9, 13, 0x37e5ff], [23, -18, 10, 8, 16, 0xff619f],
      [-24, 18, 8, 10, 11, 0xffad45], [24, 19, 9, 8, 14, 0x6ef7d2],
      [-8, -29, 6, 7, 8, 0xff6d4c], [13, -28, 7, 6, 10, 0x50d7ff],
    ];
    for (let i = 0; i < mid.length; i++) {
      const [x, z, w, d, h, c] = mid[i];
      this.buildBuilding(x, z, w, d, h, { tex: windowTextures[(i + 2) % windowTextures.length], accent: c, roof: true });
    }

    // Neon billboards.
    this.buildBillboard(-23, 7.5, -10.14, 6.2, 2.1, 'ROBOTS', '#dffaff', '#2be9ff', 0);
    this.buildBillboard(23, 9.2, -13.95, 7.9, 2.4, 'GAMEVIAL', '#ffe1b4', '#ff7b39', Math.PI);
    this.buildBillboard(-24, 5.7, 22.94, 5.5, 1.8, 'SHOCKWAVE', '#f6eaff', '#d35bff', Math.PI);
    this.buildBillboard(24, 6.4, 14.95, 5.8, 1.9, 'VENUS', '#fff0d3', '#ff3b74', 0);
    this.buildBillboard(-26, 20, -36, 9, 3, 'WE ARE THE ROBOTS', '#fff7d6', '#ffb02e', Math.PI, 1.2);
    this.buildBillboard(8, 16, -35.2, 8, 2.6, 'CITYSCAPE // 2088', '#d9fbff', '#23d9ff', 0, 1.0);

    // Cover crates / barricades.
    const crates = [
      [-9, 11, 2.2, 1.8, 2.2, 0xd95cff], [9, 12, 2.4, 1.3, 2.4, 0x57e9ff],
      [-15, -7, 3.2, 1.2, 1.8, 0xffa640], [16, -6, 2.2, 2.0, 2.2, 0xff5b77],
      [2, -18, 3.6, 1.25, 2.0, 0x69f6cb], [-4, 23, 2.0, 1.0, 2.0, 0x5a94ff],
      [29, 2, 2.6, 1.6, 2.6, 0xffc247], [-29, 4, 2.6, 2.1, 2.6, 0x9a63ff],
    ];
    for (const [x, z, w, h, d, c] of crates) this.buildCrate(x, z, w, h, d, c);

    // Elevated catwalks with jump pads.
    this.buildCatwalk(-16, -7, 10, 6, 2.8, 0x24d7ff);
    this.buildCatwalk(17, 8, 9, 7, 3.4, 0xff8b3d);
    this.buildJumpPad(-16, 4.2, 0x37f4ff);
    this.buildJumpPad(17, -6.8, 0xffb13b);

    // Ground-level holo pillars / beacons.
    for (const [x, z, c] of [[-33, -18, 0x25e9ff], [33, 18, 0xff6b57], [-33, 19, 0xffbf47], [34, -17, 0x65ffc2]]) {
      this.buildBeacon(x, z, c);
    }

    // Perimeter barriers.
    this.buildBarriers();

    // Portal to Venus.
    this.buildPortal(0, 3.0, -33.5);

    // Spawn points around the edges of the central play space.
    this.playerSpawn.set(0, 0, 27);
    this.spawnPoints = [
      new THREE.Vector3(-19, 0, -2), new THREE.Vector3(19, 0, -3), new THREE.Vector3(1, 0, -22),
      new THREE.Vector3(-14, 0, 8), new THREE.Vector3(14, 0, 13), new THREE.Vector3(-6, 0, 17),
      new THREE.Vector3(29, 0, 4), new THREE.Vector3(-29, 0, 9), new THREE.Vector3(7, 0, -8),
      new THREE.Vector3(-8, 0, -10), new THREE.Vector3(30, 0, 24), new THREE.Vector3(-30, 0, 25),
    ];

    // Animated ambient traffic.
    for (let i = 0; i < 7; i++) this.buildFlyCar(i);
    this.buildAmbientClouds();
    this.addCityHeroLighting();

    return this;
  }

  buildSky(colors, sunDir) {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(260, 32, 20), makeSkyMaterial(colors, sunDir));
    sky.frustumCulled = false;
    this.group.add(sky);
    this.sky = sky;

    // Low sun disc, mostly swallowed by the atmospheric haze.
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(13, 32), new THREE.MeshBasicMaterial({ color: colors.sun, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sunDisc.position.copy(sunDir).multiplyScalar(190);
    sunDisc.lookAt(0, 0, 0);
    this.group.add(sunDisc);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createGlowTexture('#' + colors.sun.getHexString()), color: colors.sun, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    glow.position.copy(sunDir).multiplyScalar(185);
    glow.scale.setScalar(80);
    this.group.add(glow);

    // Haze clouds.
    const cloudTex = makeCanvasTexture(256, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const rnd = mulberry32(8);
      for (let i = 0; i < 28; i++) {
        const x = 30 + rnd() * (w - 60);
        const y = 30 + rnd() * (h - 60);
        const r = 18 + rnd() * 44;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.12)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    });
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: colors.horizon, transparent: true, opacity: 0.4, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      const ang = rand(0, TAU);
      cloud.position.set(Math.cos(ang) * 110, rand(18, 50), Math.sin(ang) * 110);
      cloud.scale.set(rand(70, 130), rand(15, 30), 1);
      cloud.material.rotation = rand(-0.4, 0.4);
      this.group.add(cloud);
    }
  }

  buildLights(sunDir, kind) {
    const hemi = new THREE.HemisphereLight(kind === 'city' ? 0x9adfff : 0xffb27a, kind === 'city' ? 0x19263f : 0x2b0b1e, kind === 'city' ? 1.15 : 0.86);
    this.scene.add(hemi);
    this.scene.userData.hemi = hemi;

    const sun = new THREE.DirectionalLight(kind === 'city' ? 0xffd4a3 : 0xff7a52, kind === 'city' ? 2.9 : 2.2);
    sun.position.copy(sunDir).multiplyScalar(70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 180;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.userData.sun = sun;
    this.sunLight = sun;

    const fill = new THREE.DirectionalLight(kind === 'city' ? 0x4f9cff : 0xff3a9e, kind === 'city' ? 0.7 : 0.9);
    fill.position.set(-30, 22, 35);
    this.scene.add(fill);
    this.scene.userData.fill = fill;
  }

  addCityHeroLighting() {
    const p1 = new THREE.PointLight(0x22d9ff, 24, 24, 2);
    p1.position.set(6, 8, 6);
    this.group.add(p1);
    const p2 = new THREE.PointLight(0xff7438, 18, 20, 2);
    p2.position.set(-12, 6, -14);
    this.group.add(p2);
  }

  buildBuilding(x, z, w, d, h, { tex, accent = 0x34e6ff, rotation = 0, roof = false } = {}) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    const mat = new THREE.MeshStandardMaterial({
      map: tex, color: 0x8da1b9, roughness: 0.54, metalness: 0.36,
      emissiveMap: tex, emissive: new THREE.Color(accent).multiplyScalar(0.38), emissiveIntensity: 0.8,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    this.raycastMeshes.push(body);

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0b1727, roughness: 0.52, metalness: 0.55 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 1.1, d + 0.5), baseMat);
    base.position.y = 0.55;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const roofBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.22, d + 0.3), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2.3, metalness: 0.2, roughness: 0.3 }));
    roofBand.position.y = h;
    group.add(roofBand);

    // Vertical neon strips on two corners.
    for (const sx of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.78, 0.12), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      strip.position.set(sx * (w / 2 - 0.1), h * 0.52, d / 2 + 0.08);
      group.add(strip);
    }

    if (roof) {
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x17273a, roughness: 0.7, metalness: 0.4 });
      for (let i = 0; i < 3; i++) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(rand(1, 2.6), rand(0.4, 1.1), rand(1, 2)), roofMat);
        ac.position.set(rand(-w * 0.28, w * 0.28), h + 0.5, rand(-d * 0.25, d * 0.25));
        ac.castShadow = true;
        group.add(ac);
      }
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, rand(2, 5), 6), new THREE.MeshStandardMaterial({ color: 0x5f748b, metalness: 0.9, roughness: 0.2 }));
      antenna.position.set(w * 0.24, h + antenna.geometry.parameters.height / 2, d * 0.1);
      group.add(antenna);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d4d }));
      tip.position.set(w * 0.24, h + antenna.geometry.parameters.height, d * 0.1);
      group.add(tip);
      this.beacons.push({ mesh: tip, phase: rand(0, TAU) });
    }

    this.group.add(group);
    // Rotated buildings use a conservative axis-aligned collider.
    const pad = rotation === 0 ? 0 : 0.5;
    this.addSolid(x - w / 2 - pad, 0, z - d / 2 - pad, x + w / 2 + pad, h, z + d / 2 + pad, { standable: true, tag: 'building' });
    this.mapPoints.push({ x, z, w: Math.max(w, d), kind: 'building' });
    return group;
  }

  buildBillboard(x, y, z, w, h, text, fg, accent, rotY = 0, scale = 1) {
    const tex = createTextTexture(text, { width: 1024, height: 220, fg, glow: accent, font: '900 132px Arial Black, Arial, sans-serif', stroke: 'rgba(0,0,0,0.55)' });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * scale, h * scale), mat);
    plane.position.set(x, y, z);
    plane.rotation.y = rotY;
    this.group.add(plane);
    this.billboardMats.push({ mat, base: 0.8 + Math.random() * 0.2, phase: rand(0, TAU) });
    // Frame.
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(w * scale + 0.5, h * scale + 0.35), new THREE.MeshBasicMaterial({ color: 0x07111c, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    frame.position.copy(plane.position);
    frame.rotation.y = rotY;
    frame.position.z += rotY === 0 ? -0.05 : 0.05;
    this.group.add(frame);
    return plane;
  }

  buildCrate(x, z, w, h, d, color) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b293a, metalness: 0.64, roughness: 0.38 });
    const accentMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    // Panel ribbon.
    for (const side of [-1, 0, 1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(side === 0 ? w * 0.7 : 0.1, 0.1, side === 0 ? 0.08 : d * 0.7), accentMat);
      band.position.set(side === 0 ? 0 : side * (w / 2 + 0.02), h * 0.62, side === 0 ? d / 2 + 0.045 : 0);
      group.add(band);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.95, 0.08, d * 0.95), accentMat);
    top.position.y = h + 0.02;
    top.material = accentMat.clone();
    top.material.emissiveIntensity = 0.5;
    group.add(top);
    this.group.add(group);
    this.raycastMeshes.push(body);
    this.addSolid(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, { standable: true, tag: 'crate' });
  }

  buildCatwalk(x, z, w, d, y, color) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x1b3045, metalness: 0.7, roughness: 0.32 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), deckMat);
    deck.position.y = y;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);
    const trimMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const side of [-1, 1]) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.06, 0.08), trimMat);
      trim.position.set(0, y + 0.2, side * (d / 2 - 0.04));
      group.add(trim);
      const trimX = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, d + 0.1), trimMat);
      trimX.position.set(side * (w / 2 - 0.04), y + 0.2, 0);
      group.add(trimX);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, y, 7), new THREE.MeshStandardMaterial({ color: 0x182c3e, metalness: 0.85, roughness: 0.25 }));
        pillar.position.set(sx * (w / 2 - 0.8), y / 2, sz * (d / 2 - 0.8));
        pillar.castShadow = true;
        group.add(pillar);
      }
    }
    // Holographic rail.
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.055, 0.055), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      rail.position.set(0, y + 1.0, side * (d / 2 - 0.08));
      group.add(rail);
    }
    this.group.add(group);
    this.raycastMeshes.push(deck);
    this.addSolid(x - w / 2, y - 0.2, z - d / 2, x + w / 2, y + 0.18, z + d / 2, { standable: true, tag: 'catwalk' });
    this.mapPoints.push({ x, z, w, kind: 'platform' });
  }

  buildJumpPad(x, z, color) {
    const group = new THREE.Group();
    group.position.set(x, 0.04, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x14283e, metalness: 0.75, roughness: 0.3 }));
    base.receiveShadow = true;
    group.add(base);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.085, 6, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    arrow.position.y = 0.6;
    group.add(arrow);
    this.group.add(group);
    this.jumpPads.push({ x, z, radius: 1.4, group, ring, arrow, cooldown: 0, color });
  }

  buildBeacon(x, z, color) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0x142033, metalness: 0.75, roughness: 0.3 }));
    group.add(base);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x1e3247, metalness: 0.7, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 }));
    column.position.y = 1.7;
    column.castShadow = true;
    group.add(column);
    const holo = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    holo.position.y = 3.7;
    group.add(holo);
    const light = new THREE.PointLight(color, 8, 9, 2);
    light.position.y = 3.7;
    group.add(light);
    this.group.add(group);
    this.floaters.push({ mesh: holo, baseY: 3.7, speed: rand(0.7, 1.4), phase: rand(0, TAU) });
    this.addSolid(x - 0.7, 0, z - 0.7, x + 0.7, 4, z + 0.7, { standable: true, tag: 'beacon' });
  }

  buildBarriers() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x2dd9ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const horiz = i < 2;
      const dir = i % 2 === 0 ? -1 : 1;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(88, 1.4), mat);
      plane.position.set(horiz ? 0 : dir * 45, 0.7, horiz ? dir * 45 : 0);
      plane.rotation.y = horiz ? 0 : Math.PI / 2;
      this.group.add(plane);
      const line = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 88 : 0.15, 0.06, horiz ? 0.15 : 88), new THREE.MeshBasicMaterial({ color: 0x5df6ff }));
      line.position.copy(plane.position);
      line.position.y = 1.38;
      this.group.add(line);
    }
    // Keep players inside the plaza.
    this.addSolid(-46, 0, -46, 46, 20, -44, { standable: false, tag: 'barrier' });
    this.addSolid(-46, 0, 44, 46, 20, 46, { standable: false, tag: 'barrier' });
    this.addSolid(-46, 0, -46, -44, 20, 46, { standable: false, tag: 'barrier' });
    this.addSolid(44, 0, -46, 46, 20, 46, { standable: false, tag: 'barrier' });
  }

  buildPortal(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x263b56, metalness: 0.85, roughness: 0.25, emissive: 0x1b5f8a, emissiveIntensity: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.28, 10, 42), ringMat);
    group.add(ring);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(2.45, 42), new THREE.MeshBasicMaterial({ color: 0x1a4766, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(inner);
    const swirlTex = makeCanvasTexture(512, 512, (ctx, w, h) => {
      const cx = w / 2, cy = h / 2;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 240; i++) {
        const a = i * 0.21;
        const r = 8 + i * 0.85;
        ctx.strokeStyle = `rgba(${80 + (i % 40) * 3},${220 - (i % 30) * 2},255,${0.05 + (i / 240) * 0.28})`;
        ctx.lineWidth = 2 + (i % 5);
        ctx.beginPath();
        ctx.arc(cx, cy, r, a, a + 0.8);
        ctx.stroke();
      }
    });
    const swirl = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 }));
    group.add(swirl);
    const particlesGeo = new THREE.BufferGeometry();
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const r = rand(2.4, 4.2);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a) * r;
      positions[i * 3 + 2] = rand(-0.5, 0.5);
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particlesGeo, new THREE.PointsMaterial({ color: 0x52e9ff, size: 0.1, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, map: createGlowTexture('#52e9ff') }));
    group.add(particles);
    const light = new THREE.PointLight(0x2dd9ff, 0, 16, 2);
    light.position.z = 1;
    group.add(light);
    this.group.add(group);
    // Small pedestal.
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.3, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0x15263a, metalness: 0.8, roughness: 0.3 }));
    pedestal.position.set(x, 0.15, z);
    pedestal.receiveShadow = true;
    this.group.add(pedestal);
    this.portal = { group, ring, inner, swirl, particles, light, active: false, x, z, y, radius: 3.2 };
    this.mapPoints.push({ x, z, w: 6, kind: 'portal' });
  }

  setPortalActive(active) {
    this.portalActive = active;
    if (!this.portal) return;
    this.portal.active = active;
    this.portal.ring.material.emissive.setHex(active ? 0x19ffdc : 0x1b5f8a);
    this.portal.ring.material.color.setHex(active ? 0x47ffd9 : 0x263b56);
    this.portal.inner.material.color.setHex(active ? 0x2dffbf : 0x1a4766);
    this.portal.inner.material.opacity = active ? 0.75 : 0.45;
    this.portal.swirl.material.color.setHex(active ? 0x63ffe5 : 0xffffff);
    this.portal.light.color.setHex(active ? 0x35ffcf : 0x2dd9ff);
    this.portal.light.intensity = active ? 38 : 0;
  }

  buildFlyCar(i) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff5c6e : 0x53ddff, metalness: 0.65, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.8), mat);
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.7), new THREE.MeshStandardMaterial({ color: 0x9fe6ff, emissive: 0x2ba2ff, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.2 }));
    cabin.position.set(0.1, 0.34, 0);
    group.add(cabin);
    for (const side of [-1, 1]) {
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 8), new THREE.MeshBasicMaterial({ color: 0xffa544 }));
      engine.rotation.z = Math.PI / 2;
      engine.position.set(-0.9, 0, side * 0.32);
      group.add(engine);
    }
    const y = 10 + i * 3.2;
    group.position.set(rand(-40, 40), y, rand(-40, 40));
    this.group.add(group);
    this.cars.push({ group, speed: rand(5, 11), dir: i % 2 ? 1 : -1, radius: 20 + i * 7, angle: rand(0, TAU), y });
  }

  buildAmbientClouds() {
    this.windLines = [];
  }

  buildVenus() {
    this.clear();
    this.envType = 'venus';
    this.initEnv();
    this.scene.fog = new THREE.FogExp2(VENUS_SKY.fog, 0.013);
    this.scene.background = new THREE.Color(VENUS_SKY.fog);
    const sunDir = new THREE.Vector3(0.2, 0.24, -0.95).normalize();
    this.buildSky(VENUS_SKY, sunDir);
    this.buildLights(sunDir, 'venus');

    // Lava sea far below.
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff4d1a, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false });
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), lavaMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = -14;
    this.group.add(lava);
    const lavaGlow = new THREE.PointLight(0xff4d1a, 70, 110, 1.4);
    lavaGlow.position.set(0, -8, 0);
    this.group.add(lavaGlow);
    this.scene.userData.lava = lavaGlow;

    // Floating rock arena.
    const tex = makeGroundTexture('venus');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 7);
    const groundMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xb47a6d, roughness: 0.92, metalness: 0.12, emissive: 0x3b0b16, emissiveIntensity: 0.7 });
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(43, 33, 4.5, 14, 1), groundMat);
    ground.position.y = -2.25;
    ground.receiveShadow = true;
    this.group.add(ground);
    this.raycastMeshes.push(ground);

    // Cracks glowing through the arena.
    const rnd = mulberry32(511);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * TAU;
      const r = 4 + rnd() * 34;
      const len = 2 + rnd() * 8;
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, len), new THREE.MeshBasicMaterial({ color: 0xff6d2a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      crack.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
      crack.rotation.y = a + rnd() * 1.2;
      this.group.add(crack);
    }

    // Giant monolithic rocks and ruined columns.
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a2734, roughness: 0.9, metalness: 0.15 });
    const rockPositions = [
      [-25, -12, 4.5, 8], [27, -14, 5, 11], [-30, 14, 5.5, 9], [29, 15, 4, 6.5],
      [-12, -30, 4, 7], [12, -31, 5, 10], [-20, 30, 4, 8], [21, 29, 6, 12],
    ];
    for (let i = 0; i < rockPositions.length; i++) {
      const [x, z, r, h] = rockPositions[i];
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
      rock.scale.y = h / r * 0.6;
      rock.position.set(x, h * 0.4, z);
      rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
      this.raycastMeshes.push(rock);
      this.addSolid(x - r * 0.65, 0, z - r * 0.65, x + r * 0.65, h, z + r * 0.65, { standable: true, tag: 'rock' });
    }

    // Broken arch and boss altar.
    this.buildVenusArch(0, -27, 0xffa347);
    // Glowing crystals.
    for (const [x, z, c] of [[-18, 3, 0xff4fd8], [18, -7, 0xff7a3d], [-8, -20, 0xffcf5c], [9, 20, 0xd75bff]]) {
      this.buildCrystal(x, z, c);
    }
    // Lava geysers around the rim.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const r = 38;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(2 + rand(0, 2), 6 + rand(0, 7), 6), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.position.set(Math.cos(a) * r, -4 + rand(0, 3), Math.sin(a) * r);
      this.group.add(flame);
      this.floaters.push({ mesh: flame, baseY: flame.position.y, speed: 0.5, phase: a, kind: 'flame' });
    }

    this.playerSpawn.set(0, 0, 27);
    this.spawnPoints = [
      new THREE.Vector3(-16, 0, -4), new THREE.Vector3(16, 0, -8), new THREE.Vector3(0, 0, -18),
      new THREE.Vector3(-19, 0, 12), new THREE.Vector3(19, 0, 14), new THREE.Vector3(-6, 0, 8),
      new THREE.Vector3(9, 0, 2), new THREE.Vector3(-12, 0, -21), new THREE.Vector3(12, 0, -24),
    ];

    // Ash / embers.
    const pcount = 420;
    const pgeom = new THREE.BufferGeometry();
    const pp = new Float32Array(pcount * 3);
    for (let i = 0; i < pcount; i++) {
      pp[i * 3] = rand(-50, 50);
      pp[i * 3 + 1] = rand(0, 40);
      pp[i * 3 + 2] = rand(-50, 50);
    }
    pgeom.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const ash = new THREE.Points(pgeom, new THREE.PointsMaterial({ color: 0xffa66a, size: 0.12, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: createGlowTexture('#ff9a5a') }));
    this.group.add(ash);
    this.ambientParticles = { mesh: ash, positions: pp, count: pcount };

    this.buildAmbientClouds();
    this.setPortalActive(false);
    return this;
  }

  buildVenusArch(x, z, color) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x41222d, metalness: 0.2, roughness: 0.85 });
    const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.1, 8, 6), mat);
      pillar.position.set(side * 4.5, 4, 0);
      pillar.rotation.z = side * 0.06;
      pillar.castShadow = true;
      group.add(pillar);
      this.addSolid(x + side * 4.5 - 0.85, 0, z - 0.85, x + side * 4.5 + 0.85, 8, z + 0.85, { standable: true, tag: 'arch' });
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 1.35), glow);
      band.position.set(side * 4.5, 6.4, 0);
      group.add(band);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.8, 1.3), mat);
    top.position.y = 8.1;
    top.rotation.z = 0.03;
    top.castShadow = true;
    group.add(top);
    const topGlow = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.12), glow);
    topGlow.position.set(0, 8.06, 0.66);
    group.add(topGlow);
    this.group.add(group);
    this.mapPoints.push({ x, z, w: 8, kind: 'arch' });
  }

  buildCrystal(x, z, color) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), new THREE.MeshStandardMaterial({ color: 0x3a202b, roughness: 0.85 }));
    base.position.y = 0.6;
    base.castShadow = true;
    group.add(base);
    for (let i = 0; i < 4; i++) {
      const h = 2 + Math.random() * 3.5;
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.35 + Math.random() * 0.3, h, 6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.7, metalness: 0.2, roughness: 0.25, transparent: true, opacity: 0.9 }));
      crystal.position.set(rand(-0.7, 0.7), 0.8 + h / 2, rand(-0.7, 0.7));
      crystal.rotation.z = rand(-0.3, 0.3);
      crystal.castShadow = true;
      group.add(crystal);
    }
    const light = new THREE.PointLight(color, 14, 13, 2);
    light.position.y = 2.5;
    group.add(light);
    this.group.add(group);
    this.addSolid(x - 1.2, 0, z - 1.2, x + 1.2, 2.6, z + 1.2, { standable: true, tag: 'crystal' });
  }

  addDecalStrip(x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.group.add(mesh);
  }

  addGlowStrip(x, y, z, w, h, d, color, opacity = 1, rot = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rot;
    this.group.add(mesh);
    return mesh;
  }

  getGroundHeight(x, z, feetY) {
    let ground = 0;
    for (const s of this.solids) {
      if (!s.standable) continue;
      if (x < s.minX - 0.1 || x > s.maxX + 0.1 || z < s.minZ - 0.1 || z > s.maxZ + 0.1) continue;
      if (s.maxY <= feetY + 0.52 && s.maxY > ground) ground = s.maxY;
    }
    return ground;
  }

  resolveHorizontal(pos, radius, height) {
    for (const s of this.solids) {
      if (s.tag === 'barrier') {
        if (pos.x - radius < s.maxX && pos.x + radius > s.minX && pos.z - radius < s.maxZ && pos.z + radius > s.minZ) {
          // The barriers sit outside the playfield; clamp below is enough.
        }
        continue;
      }
      if (s.maxY <= pos.y + 0.55) continue;
      if (pos.y + height <= s.minY + 0.05 || pos.y >= s.maxY - 0.04) continue;
      const minX = s.minX - radius;
      const maxX = s.maxX + radius;
      const minZ = s.minZ - radius;
      const maxZ = s.maxZ + radius;
      if (pos.x <= minX || pos.x >= maxX || pos.z <= minZ || pos.z >= maxZ) continue;
      const dl = pos.x - minX;
      const dr = maxX - pos.x;
      const db = pos.z - minZ;
      const df = maxZ - pos.z;
      const m = Math.min(dl, dr, db, df);
      if (m === dl) pos.x = minX;
      else if (m === dr) pos.x = maxX;
      else if (m === db) pos.z = minZ;
      else pos.z = maxZ;
    }
    pos.x = THREE.MathUtils.clamp(pos.x, -43.5, 43.5);
    pos.z = THREE.MathUtils.clamp(pos.z, -43.5, 43.5);
  }

  checkJumpPads(pos) {
    for (const pad of this.jumpPads) {
      if (pad.cooldown > 0) continue;
      const dx = pos.x - pad.x;
      const dz = pos.z - pad.z;
      if (dx * dx + dz * dz < pad.radius * pad.radius && pos.y < 1.4) {
        pad.cooldown = 0.8;
        return pad;
      }
    }
    return null;
  }

  update(dt, time) {
    this.time += dt;
    const t = this.time;
    if (this.portal) {
      this.portal.ring.rotation.z += dt * (this.portal.active ? 1.15 : 0.24);
      this.portal.swirl.rotation.z -= dt * (this.portal.active ? 1.8 : 0.4);
      this.portal.particles.rotation.z += dt * 0.7;
      this.portal.swirl.material.opacity = this.portal.active ? 0.65 + Math.sin(t * 5) * 0.2 : 0.3;
      if (this.portal.active) this.portal.light.intensity = 30 + Math.sin(t * 6) * 13;
    }
    for (const pad of this.jumpPads) {
      pad.cooldown = Math.max(0, pad.cooldown - dt);
      pad.ring.rotation.z += dt * 2.1;
      pad.arrow.position.y = 0.55 + Math.sin(t * 4 + pad.x) * 0.2;
      pad.arrow.rotation.y += dt * 1.2;
    }
    for (const billboard of this.billboardMats) {
      billboard.mat.opacity = billboard.base + Math.sin(t * 2.3 + billboard.phase) * 0.1;
    }
    for (const beacon of this.beacons) {
      beacon.mesh.material.color.setHSL(0.0, 1, 0.55 + Math.sin(t * 4 + beacon.phase) * 0.2);
    }
    for (const f of this.floaters) {
      if (f.kind === 'flame') {
        f.mesh.scale.y = 0.8 + Math.sin(t * 3 + f.phase) * 0.25;
      } else {
        f.mesh.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * 0.25;
        f.mesh.rotation.y += dt * 0.55;
      }
    }
    if (this.portal) {
      this.portal.particles.updateMatrixWorld();
    }
    for (const car of this.cars) {
      car.angle += car.speed * dt * car.dir * 0.012;
      car.group.position.set(Math.cos(car.angle) * car.radius, car.y + Math.sin(t * 0.8 + car.radius) * 0.3, Math.sin(car.angle) * car.radius);
      car.group.rotation.y = -car.angle + (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.group.rotation.z = Math.sin(t * 0.6 + car.radius) * 0.04;
    }
    if (this.ambientParticles) {
      const p = this.ambientParticles;
      for (let i = 0; i < p.count; i++) {
        p.positions[i * 3 + 1] += dt * (1.2 + (i % 5) * 0.25);
        p.positions[i * 3] += Math.sin(t + i) * dt * 0.2;
        if (p.positions[i * 3 + 1] > 40) p.positions[i * 3 + 1] = 0;
      }
      p.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  disposeLights() {
    // Lights added directly to the scene are removed when a new environment is built.
    for (const key of ['hemi', 'sun', 'fill', 'lava']) {
      const obj = this.scene.userData[key];
      if (obj) {
        this.scene.remove(obj);
        if (obj.dispose) obj.dispose();
        delete this.scene.userData[key];
      }
    }
  }

  rebuildCity() {
    this.disposeLights();
    this.buildCity();
  }

  rebuildVenus() {
    this.disposeLights();
    this.buildVenus();
  }
}
