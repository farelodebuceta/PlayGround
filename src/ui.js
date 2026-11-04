import { WEAPONS } from './weapons.js';
import { clamp, formatTime, pad, TAU } from './util.js';

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.selectedTeam = localStorage.getItem('watr-team') || 'blue';
    this.sensitivity = Number(localStorage.getItem('watr-sense') || 1);
    this.volume = Number(localStorage.getItem('watr-volume') || 0.72);
    this.highScore = Number(localStorage.getItem('watr-highscore') || 0);
    this.onDeploy = () => {};
    this.onResume = () => {};
    this.onQuit = () => {};
    this.onRetry = () => {};
    this.onMenu = () => {};
    this.onChat = () => {};
    this.onTouchWeapon = () => {};
    this.onInteract = () => {};
    this.onPause = () => {};
    this.touch = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, jump: false, firePressed: false };
    this.chatOpen = false;
    this.mobile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.damageTimer = 0;
    this.feedRows = [];
    this.slotEls = [];
    this.lastWave = '';
    this.cache();
    this.bind();
    this.buildSlots();
    this.updateMenuHighscore();
    this.setSelectedTeam(this.selectedTeam, false);
    this.applySettings();
  }

  cache() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      boot: $('boot'), bootProgress: $('boot-progress'), bootStatus: $('boot-status'),
      menu: $('menu'), hud: $('hud'), touch: $('touch-controls'),
      deploy: $('deploy-btn'), how: $('how-btn'), howClose: $('how-close'), howModal: $('how'), sound: $('sound-btn'),
      cards: Array.from(document.querySelectorAll('.chassis-card')),
      menuHighscore: $('menu-highscore'), menuHighscoreSub: $('menu-highscore-sub'),
      score: $('score'), wave: $('wave'), kills: $('kills'), objective: $('objective'),
      healthBar: $('health-bar'), armorBar: $('armor-bar'), healthVal: $('health-val'), armorVal: $('armor-val'),
      ammoMag: $('ammo-mag'), ammoMax: $('ammo-max'), ammoReserve: $('ammo-reserve'),
      weaponName: $('weapon-name'), weaponType: $('weapon-type'), weaponSlots: $('weapon-slots'),
      reloadBar: $('reload-bar'), reloadLabel: $('reload-label'), playerName: $('player-name'),
      crosshair: $('crosshair'), hitmarker: $('hitmarker'), scope: $('scope'),
      killfeed: $('killfeed'), chatLog: $('chat-log'), chatEntry: $('chat-entry'), chatInput: $('chat-input'),
      waveBanner: $('wave-banner'), toast: $('toast'), interact: $('interact'),
      damage: $('damage-flash'), speedLines: $('speed-lines'), medals: $('medals'),
      bossBar: $('boss-bar'), bossName: document.querySelector('.boss-name'), bossFill: $('boss-fill'), fade: $('fade'),
      pause: $('pause'), pauseScore: $('pause-score'), pauseWave: $('pause-wave'), pauseAcc: $('pause-acc'),
      resume: $('resume-btn'), quit: $('quit-btn'),
      gameover: $('gameover'), endKicker: $('end-kicker'), endTitle: $('end-title'), endBlurb: $('end-blurb'),
      endScore: $('end-score'), endKills: $('end-kills'), endAcc: $('end-acc'), endTime: $('end-time'),
      endRecord: $('end-record'), retry: $('retry-btn'), menuBtn: $('menu-btn'),
      sense: $('sense'), senseVal: $('sense-val'), volume: $('volume'), volumeVal: $('volume-val'),
      minimap: $('minimap'), ping: $('ping'), botCount: $('bot-count'),
      joystick: $('joystick'), knob: $('joystick-knob'), lookZone: $('look-zone'),
      fire: $('btn-fire'), jump: $('btn-jump'), reload: $('btn-reload'), swap: $('btn-swap'), chatBtn: $('btn-chat'), pauseBtn: $('btn-pause'),
    };
    this.mctx = this.el.minimap.getContext('2d');
    this.objective = this.el.objective;
    this.sectorLabel = $('sector-label');
    this.joystickPointer = null;
    this.lookPointer = null;
  }

  bind() {
    for (const card of this.el.cards) {
      card.addEventListener('click', () => {
        this.setSelectedTeam(card.dataset.team, true);
      });
    }
    this.el.deploy.addEventListener('click', () => {
      this.audio.init();
      this.audio.play('ui');
      this.onDeploy(this.selectedTeam);
    });
    this.el.how.addEventListener('click', () => {
      this.audio.play('ui');
      this.el.howModal.classList.remove('hidden');
    });
    this.el.howClose.addEventListener('click', () => {
      this.audio.play('ui');
      this.el.howModal.classList.add('hidden');
    });
    this.el.sound.addEventListener('click', () => {
      this.audio.init();
      const muted = this.audio.toggleMute();
      this.el.sound.textContent = muted ? '×))' : '◖))';
      this.el.sound.title = muted ? 'Unmute' : 'Mute';
      this.saveSettings();
    });
    this.el.resume.addEventListener('click', () => { this.audio.play('ui'); this.onResume(); });
    this.el.quit.addEventListener('click', () => { this.audio.play('ui'); this.onQuit(); });
    this.el.retry.addEventListener('click', () => { this.audio.play('ui'); this.onRetry(); });
    this.el.menuBtn.addEventListener('click', () => { this.audio.play('ui'); this.onMenu(); });
    this.el.sense.addEventListener('input', () => {
      this.sensitivity = Number(this.el.sense.value);
      this.el.senseVal.textContent = this.sensitivity.toFixed(2);
      this.saveSettings();
    });
    this.el.volume.addEventListener('input', () => {
      this.volume = Number(this.el.volume.value);
      this.el.volumeVal.textContent = `${Math.round(this.volume * 100)}%`;
      this.audio.setVolume(this.volume);
      this.saveSettings();
    });
    this.el.interact.addEventListener('click', (e) => {
      e.preventDefault();
      this.onInteract();
    });
    this.el.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = this.el.chatInput.value.trim();
        if (text) this.onChat(text);
        this.closeChat();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeChat();
      }
    });

    this.bindTouch();
  }

  bindTouch() {
    const joy = this.el.joystick;
    const knob = this.el.knob;
    const move = (e) => {
      if (this.joystickPointer !== e.pointerId) return;
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (e.clientX - cx) / (rect.width * 0.36);
      let dy = (e.clientY - cy) / (rect.height * 0.36);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.touch.moveX = dx;
      this.touch.moveY = dy;
      knob.style.transform = `translate(${dx * 35}px, ${dy * 35}px)`;
      e.preventDefault();
    };
    joy.addEventListener('pointerdown', (e) => {
      this.joystickPointer = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      move(e);
      e.preventDefault();
    });
    joy.addEventListener('pointermove', move);
    const endJoy = (e) => {
      if (this.joystickPointer !== e.pointerId) return;
      this.joystickPointer = null;
      this.touch.moveX = 0;
      this.touch.moveY = 0;
      knob.style.transform = 'translate(0,0)';
    };
    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);

    const look = this.el.lookZone;
    look.addEventListener('pointerdown', (e) => {
      this.lookPointer = e.pointerId;
      this.touch.lastLookX = e.clientX;
      this.touch.lastLookY = e.clientY;
      look.setPointerCapture(e.pointerId);
    });
    look.addEventListener('pointermove', (e) => {
      if (this.lookPointer !== e.pointerId) return;
      this.touch.lookX += (e.clientX - this.touch.lastLookX) * 1.2;
      this.touch.lookY += (e.clientY - this.touch.lastLookY) * 1.2;
      this.touch.lastLookX = e.clientX;
      this.touch.lastLookY = e.clientY;
    });
    const endLook = (e) => { if (this.lookPointer === e.pointerId) this.lookPointer = null; };
    look.addEventListener('pointerup', endLook);
    look.addEventListener('pointercancel', endLook);

    this.el.fire.addEventListener('pointerdown', (e) => {
      this.touch.fire = true;
      this.touch.firePressed = true;
      e.preventDefault();
    });
    const unfire = (e) => { this.touch.fire = false; e.preventDefault(); };
    this.el.fire.addEventListener('pointerup', unfire);
    this.el.fire.addEventListener('pointercancel', unfire);
    this.el.fire.addEventListener('pointerleave', () => { this.touch.fire = false; });
    this.el.jump.addEventListener('pointerdown', (e) => { this.touch.jump = true; e.preventDefault(); });
    this.el.reload.addEventListener('pointerdown', (e) => { this.onTouchWeapon('reload'); e.preventDefault(); });
    this.el.swap.addEventListener('pointerdown', (e) => { this.onTouchWeapon('swap'); e.preventDefault(); });
    this.el.chatBtn.addEventListener('pointerdown', (e) => { this.openChat(); e.preventDefault(); });
    this.el.pauseBtn.addEventListener('pointerdown', (e) => { this.onPause(); e.preventDefault(); });
  }

  setSelectedTeam(team, click = true) {
    this.selectedTeam = team === 'red' ? 'red' : 'blue';
    localStorage.setItem('watr-team', this.selectedTeam);
    for (const card of this.el.cards) {
      const on = card.dataset.team === this.selectedTeam;
      card.classList.toggle('selected', on);
      card.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    if (click) {
      this.audio.init();
      this.audio.play('switch');
    }
  }

  updateMenuHighscore() {
    this.el.menuHighscore.textContent = String(this.highScore).padStart(6, '0');
    this.el.menuHighscoreSub.textContent = this.highScore > 0 ? 'CHASSIS RECORD // LOCAL' : 'NO RECORD YET';
  }

  applySettings() {
    this.el.sense.value = this.sensitivity;
    this.el.senseVal.textContent = this.sensitivity.toFixed(2);
    this.el.volume.value = this.volume;
    this.el.volumeVal.textContent = `${Math.round(this.volume * 100)}%`;
    this.audio.setVolume(this.volume);
  }

  saveSettings() {
    localStorage.setItem('watr-sense', this.sensitivity);
    localStorage.setItem('watr-volume', this.volume);
    localStorage.setItem('watr-team', this.selectedTeam);
  }

  setBootProgress(p, status) {
    this.el.bootProgress.style.width = `${clamp(p, 0, 1) * 100}%`;
    if (status) this.el.bootStatus.textContent = status;
  }

  hideBoot() {
    this.el.boot.classList.add('hidden');
  }

  showMenu() {
    this.el.menu.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
    this.el.howModal.classList.add('hidden');
    this.el.scope.classList.add('hidden');
    this.el.chatEntry.classList.add('hidden');
    this.chatOpen = false;
    this.el.boot.classList.add('hidden');
    this.updateMenuHighscore();
  }

  showHUD() {
    this.el.menu.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    if (this.mobile) this.el.touch.classList.remove('hidden');
    this.el.pause.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
    this.el.scope.classList.add('hidden');
    this.el.howModal.classList.add('hidden');
    this.el.chatEntry.classList.add('hidden');
    this.chatOpen = false;
    this.el.chatLog.innerHTML = '';
    this.el.killfeed.innerHTML = '';
    this.el.medals.innerHTML = '';
    this.feedRows = [];
    this.lastWave = '';
  }

  showPause(show, state) {
    this.el.pause.classList.toggle('hidden', !show);
    if (show && state) {
      this.el.pauseScore.textContent = String(state.score).padStart(6, '0');
      this.el.pauseWave.textContent = String(state.wave).padStart(2, '0');
      this.el.pauseAcc.textContent = `${state.accuracy}%`;
    }
  }

  showGameOver({ victory = false, stats, record = false }) {
    this.el.gameover.classList.remove('hidden');
    this.el.scope.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    if (victory) {
      this.el.endKicker.textContent = 'VENUS BREACHED // SIGNAL SECURE';
      this.el.endKicker.classList.remove('danger');
      this.el.endTitle.textContent = 'ARENA CLEARED';
      this.el.endBlurb.textContent = 'The Warden is scrap. The portal is quiet. Somewhere in the city, a new robot is already booting up.';
    } else {
      this.el.endKicker.textContent = 'SIGNAL LOST';
      this.el.endKicker.classList.add('danger');
      this.el.endTitle.textContent = 'CHASSIS DESTROYED';
      this.el.endBlurb.textContent = 'The arena claims another operator. Rebuild. Redeploy. Try to be less flammable.';
    }
    this.el.endScore.textContent = String(stats.score).padStart(6, '0');
    this.el.endKills.textContent = String(stats.kills).padStart(2, '0');
    this.el.endAcc.textContent = `${stats.accuracy}%`;
    this.el.endTime.textContent = formatTime(stats.time);
    this.el.endRecord.classList.toggle('hidden', !record);
    if (record) {
      this.highScore = stats.score;
      localStorage.setItem('watr-highscore', String(this.highScore));
      this.updateMenuHighscore();
    }
  }

  hideGameOver() {
    this.el.gameover.classList.add('hidden');
  }

  setSector(name) {
    if (this.sectorLabel) this.sectorLabel.textContent = name;
  }

  setTeam(team, name) {
    this.selectedTeam = team;
    this.el.playerName.textContent = name;
    const chip = document.querySelector('.player-chip .chip-mark');
    if (chip) chip.style.color = team === 'red' ? '#ff815f' : '#45e8ff';
  }

  setHUD(state) {
    this.el.score.textContent = String(state.score).padStart(6, '0');
    if (this.lastWave !== state.waveLabel) {
      this.el.wave.textContent = state.waveLabel;
      this.lastWave = state.waveLabel;
    }
    this.el.kills.textContent = String(state.kills).padStart(2, '0');
    if (state.objective) this.el.objective.textContent = state.objective;
    const hp = clamp(state.health, 0, 100);
    const ar = clamp(state.armor, 0, 100);
    this.el.healthBar.style.width = `${hp}%`;
    this.el.armorBar.style.width = `${ar}%`;
    this.el.healthVal.textContent = Math.ceil(hp);
    this.el.armorVal.textContent = Math.ceil(ar);
    this.el.healthBar.parentElement.classList.toggle('low', hp <= 28);
  }

  setWeapon(index, state) {
    const w = WEAPONS[index];
    if (!w) return;
    this.el.weaponName.textContent = w.name;
    this.el.weaponType.textContent = w.projectile === 'rocket' ? 'ANTI-ARMOR' : w.projectile === 'plasma' ? 'ENERGY' : w.id === 'sniper' ? 'PRECISION' : w.id === 'shotgun' ? 'CLOSE QUARTERS' : 'BALLISTIC';
    this.el.ammoMag.textContent = state.mag;
    this.el.ammoMax.textContent = `/ ${w.mag}`;
    this.el.ammoReserve.textContent = '∞';
    for (let i = 0; i < this.slotEls.length; i++) {
      this.slotEls[i].classList.toggle('active', i === index);
    }
    this.el.ammoMag.style.color = state.mag === 0 ? '#ff6e5f' : state.mag <= Math.ceil(w.mag * 0.25) ? '#ffc66e' : '';
    if (state.reloading) {
      this.el.reloadLabel.textContent = 'RELOADING';
      this.el.reloadBar.style.width = `${state.reloadProgress * 100}%`;
    } else if (state.mag === 0) {
      this.el.reloadLabel.textContent = 'EMPTY // PRESS R';
      this.el.reloadBar.style.width = '0%';
    } else {
      this.el.reloadLabel.textContent = 'READY';
      this.el.reloadBar.style.width = '0%';
    }
  }

  buildSlots() {
    this.el.weaponSlots.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'wslot';
      d.textContent = String(i + 1);
      d.title = w.name;
      this.el.weaponSlots.appendChild(d);
      this.slotEls.push(d);
    });
  }

  setSpread(px) {
    this.el.crosshair.style.setProperty('--bracket', `${clamp(px, 5, 36)}px`);
  }

  setADS(on) {
    this.el.crosshair.classList.toggle('ads', on);
  }

  hit(critical = false) {
    const h = this.el.hitmarker;
    h.classList.remove('active', 'critical');
    void h.offsetWidth;
    h.classList.add('active');
    if (critical) h.classList.add('critical');
  }

  damage(strength = 1) {
    this.el.damage.style.opacity = String(clamp(0.4 + strength * 0.5, 0, 0.9));
    clearTimeout(this.damageTimer);
    this.damageTimer = setTimeout(() => { this.el.damage.style.opacity = '0'; }, 130);
  }

  speedLines(on) {
    this.el.speedLines.classList.toggle('active', on);
  }

  setScope(on) {
    this.el.scope.classList.toggle('hidden', !on);
  }

  showPrompt(text) {
    if (!text) {
      this.el.interact.classList.add('hidden');
    } else {
      this.el.interact.querySelector('kbd').textContent = this.mobile ? 'TAP' : 'E';
      this.el.interact.querySelector('span').textContent = text;
      this.el.interact.classList.remove('hidden');
    }
  }

  waveBanner(title, sub, kicker = 'INCOMING') {
    const b = this.el.waveBanner;
    b.classList.remove('hidden', 'out');
    b.querySelector('.wave-kicker').textContent = kicker;
    b.querySelector('.wave-title').textContent = title;
    b.querySelector('.wave-sub').textContent = sub;
    void b.offsetWidth;
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => b.classList.add('hidden'), 450);
    }, 2200);
  }

  toast(text, duration = 2200) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), duration);
  }

  medal(text) {
    const d = document.createElement('div');
    d.className = 'medal';
    d.textContent = text;
    this.el.medals.appendChild(d);
    setTimeout(() => d.remove(), 1600);
    if (this.el.medals.children.length > 4) this.el.medals.firstChild.remove();
  }

  feed(killer, victim, weapon, killerTeam = 'blue', victimTeam = 'red', self = false) {
    const row = document.createElement('div');
    row.className = 'kf-row';
    const k = `<b class="${self ? 'kf-you' : killerTeam === 'red' ? 'kf-red' : 'kf-blue'}">${this.escape(killer)}</b>`;
    const v = `<b class="${victimTeam === 'red' ? 'kf-red' : 'kf-blue'}">${this.escape(victim)}</b>`;
    row.innerHTML = `${k}<span class="kf-weapon">[${this.escape(weapon)}]</span>${v}`;
    this.el.killfeed.appendChild(row);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.firstChild.remove();
    setTimeout(() => {
      row.classList.add('fade');
      setTimeout(() => row.remove(), 520);
    }, 5200);
  }

  chat(name, text, team = 'system', self = false) {
    const line = document.createElement('div');
    line.className = 'chat-line';
    const nameClass = self ? 'self' : team === 'red' ? 'red' : team === 'system' ? 'system' : '';
    line.innerHTML = `<b class="${nameClass}">${this.escape(name)}:</b> ${this.escape(text)}`;
    this.el.chatLog.appendChild(line);
    while (this.el.chatLog.children.length > 8) this.el.chatLog.firstChild.remove();
    this.audio.play('chat', { volume: 0.55 });
  }

  systemChat(text) {
    this.chat('ARENA', text, 'system');
  }

  escape(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  openChat() {
    if (this.chatOpen) return;
    this.chatOpen = true;
    this.el.chatEntry.classList.remove('hidden');
    this.el.chatInput.value = '';
    setTimeout(() => this.el.chatInput.focus(), 30);
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.play('ui');
  }

  closeChat() {
    this.chatOpen = false;
    this.el.chatEntry.classList.add('hidden');
    this.el.chatInput.blur();
    if (this.onChatClose) this.onChatClose();
  }

  updateMinimap(data) {
    const ctx = this.mctx;
    const w = this.el.minimap.width;
    const h = this.el.minimap.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 8;
    const scale = radius / 48;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(3,15,24,0.85)';
    ctx.fillRect(0, 0, w, h);

    // sweep
    const sweep = (data.time * 0.9) % TAU;
    const grad = ctx.createConicGradient(sweep, cx, cy);
    grad.addColorStop(0, 'rgba(62,228,255,0.18)');
    grad.addColorStop(0.14, 'rgba(62,228,255,0)');
    grad.addColorStop(1, 'rgba(62,228,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = 'rgba(64,177,202,0.13)';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * radius / 4, 0); ctx.lineTo(cx + i * radius / 4, h); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, cy + i * radius / 4); ctx.lineTo(w, cy + i * radius / 4); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(74,207,233,0.22)';
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.stroke();

    const toMap = (x, z) => [cx + x * scale, cy + z * scale];

    // static map blocks
    ctx.fillStyle = 'rgba(100,168,190,0.2)';
    for (const b of data.buildings || []) {
      const [bx, bz] = toMap(b.x, b.z);
      const s = b.w * scale;
      ctx.fillRect(bx - s / 2, bz - s / 2, s, s);
    }
    // portal
    if (data.portal) {
      const [px, pz] = toMap(data.portal.x, data.portal.z);
      ctx.strokeStyle = data.portal.active ? '#5bffd6' : '#406d86';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, pz, 4, 0, TAU); ctx.stroke();
      if (data.portal.active) {
        ctx.fillStyle = 'rgba(91,255,214,0.25)';
        ctx.beginPath(); ctx.arc(px, pz, 7, 0, TAU); ctx.fill();
      }
    }
    // pickups
    if (data.pickups) {
      ctx.fillStyle = '#71ffb6';
      for (const p of data.pickups) {
        const [x, z] = toMap(p.x, p.z);
        ctx.fillRect(x - 1.5, z - 1.5, 3, 3);
      }
    }
    // enemies
    for (const e of data.enemies || []) {
      const [x, z] = toMap(e.x, e.z);
      ctx.fillStyle = e.boss ? '#ffb13b' : '#ff6357';
      ctx.shadowColor = '#ff5348';
      ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(x, z, e.boss ? 4.5 : 2.8, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // player
    if (data.player) {
      const [x, z] = toMap(data.player.x, data.player.z);
      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(-data.player.yaw);
      ctx.fillStyle = '#7df6ff';
      ctx.shadowColor = '#45e8ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // rim highlight
    ctx.strokeStyle = 'rgba(96,220,245,0.32)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.stroke();
  }

  setBoss(show, name = 'THE VENUS WARDEN', pct = 1) {
    this.el.bossBar.classList.toggle('hidden', !show);
    if (show) {
      this.el.bossName.textContent = name;
      this.el.bossFill.style.width = `${clamp(pct, 0, 1) * 100}%`;
    }
  }

  setFade(value, duration = 0.4) {
    this.el.fade.style.transition = `opacity ${duration}s`;
    this.el.fade.style.opacity = String(value);
  }

  setBots(n) {
    this.el.botCount.textContent = `${String(n).padStart(2, '0')} BOTS`;
  }

  setPing(ms) {
    this.el.ping.textContent = `${ms}ms`;
  }

  updateTime() {}

  consumeLook() {
    const x = this.touch.lookX;
    const y = this.touch.lookY;
    this.touch.lookX = 0;
    this.touch.lookY = 0;
    return [x, y];
  }

  resetTouchLook() {
    this.touch.lookX = 0;
    this.touch.lookY = 0;
    this.touch.fire = false;
    this.touch.jump = false;
    this.touch.moveX = 0;
    this.touch.moveY = 0;
  }

  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  isChatOpen() {
    return this.chatOpen;
  }

  closeHow() {
    this.el.howModal.classList.add('hidden');
  }
}
