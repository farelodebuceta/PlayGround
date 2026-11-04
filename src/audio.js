import { clamp } from './util.js';

const NOTE = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
};

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.volume = 0.72;
    this.musicTimer = null;
    this.step = 0;
    this.musicMode = 'menu';
    this.started = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.002;
    comp.release.value = 0.24;
    comp.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(comp);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.19;
    this.musicBus.connect(comp);

    const len = this.ctx.sampleRate * 1.4;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.started = true;
    this.startMusic();
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    return this.muted;
  }

  startMusic() {
    if (this.musicTimer) return;
    this.musicTimer = setInterval(() => this.tickMusic(), 120);
  }

  setMusicMode(mode) {
    this.musicMode = mode;
    if (mode === 'combat') this.step = 0;
    if (this.musicBus) {
      const target = mode === 'combat' ? 0.23 : mode === 'boss' ? 0.27 : 0.15;
      this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8);
    }
  }

  tickMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.step = (this.step + 1) % 64;
    const s = this.step;
    const t = this.ctx.currentTime + 0.02;
    if (s % 4 === 0) this.kick(t, s === 0 ? 0.22 : 0.13);
    if (s % 8 === 4) this.hat(t, 0.035);

    const bassPattern = [NOTE.C2, 0, NOTE.C2, 0, NOTE.E2, 0, NOTE.G2, 0, NOTE.A2, 0, NOTE.A2, 0, NOTE.G2, 0, NOTE.E2, 0];
    const bass = bassPattern[(s >> 1) % bassPattern.length];
    if (bass && s % 2 === 0) this.bass(t, bass, 0.17);

    if (this.musicMode === 'combat' || this.musicMode === 'boss') {
      const arp = [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.B4, NOTE.C5, NOTE.G4, NOTE.E4, NOTE.B3];
      if (s % 2 === 1) this.arp(t, arp[(s >> 1) % arp.length], this.musicMode === 'boss' ? 0.055 : 0.04);
      if (s % 16 === 0) this.pad(t, this.musicMode === 'boss' ? NOTE.C3 : NOTE.A2, 1.8, 0.028);
    } else if (s % 16 === 0) {
      this.pad(t, NOTE.C3, 2.4, 0.025);
    }
  }

  kick(t, amp = 0.15) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.11);
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.18);
  }

  hat(t, amp = 0.03) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6700;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(hp).connect(g).connect(this.musicBus);
    src.start(t, 0.1, 0.05);
  }

  bass(t, freq, amp) {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = freq / 2;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    f.Q.value = 6;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.3);
  }

  arp(t, freq, amp) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'square';
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = 2400;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.1);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.13);
  }

  pad(t, freq, length, amp) {
    for (const [mult, detune] of [[1, -7], [1.5, 7], [2, 0]]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      o.type = 'triangle';
      o.frequency.value = freq * mult;
      o.detune.value = detune;
      f.type = 'lowpass';
      f.frequency.value = 900;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, t + length);
      o.connect(f).connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + length + 0.05);
    }
  }

  noise(t, duration, amp, filterType = 'lowpass', frequency = 1200, q = 0.8) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 1;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(frequency, t);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + duration);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.2, duration + 0.05);
  }

  tone(t, freq, duration, amp, type = 'sine', endFreq = null, bus = this.sfxBus) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + duration);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  play(name, opts = {}) {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const t = this.ctx.currentTime;
    const vol = opts.volume ?? 1;
    switch (name) {
      case 'pistol':
        this.noise(t, 0.09, 0.38 * vol, 'bandpass', 1700, 0.7);
        this.tone(t, 190, 0.12, 0.26 * vol, 'square', 75);
        break;
      case 'rifle':
        this.noise(t, 0.075, 0.33 * vol, 'bandpass', 2200, 0.8);
        this.tone(t, 150, 0.09, 0.2 * vol, 'sawtooth', 58);
        break;
      case 'shotgun':
        this.noise(t, 0.24, 0.55 * vol, 'lowpass', 1900, 0.6);
        this.tone(t, 100, 0.25, 0.32 * vol, 'square', 35);
        break;
      case 'sniper':
        this.noise(t, 0.32, 0.6 * vol, 'bandpass', 1000, 0.5);
        this.tone(t, 120, 0.35, 0.28 * vol, 'sawtooth', 34);
        this.tone(t + 0.03, 2400, 0.3, 0.025 * vol, 'sine', 600);
        break;
      case 'plasma':
        this.tone(t, 680, 0.17, 0.16 * vol, 'sawtooth', 180);
        this.tone(t, 1240, 0.12, 0.09 * vol, 'sine', 420);
        break;
      case 'rocket':
        this.noise(t, 0.4, 0.32 * vol, 'lowpass', 900, 0.8);
        this.tone(t, 90, 0.4, 0.24 * vol, 'sawtooth', 42);
        break;
      case 'dry':
        this.tone(t, 900, 0.035, 0.1 * vol, 'square', 500);
        break;
      case 'reload':
        this.tone(t, 440, 0.05, 0.1 * vol, 'square', 250);
        this.tone(t + 0.12, 320, 0.06, 0.1 * vol, 'square', 180);
        break;
      case 'reloadDone':
        this.tone(t, 540, 0.04, 0.12 * vol, 'square', 900);
        this.tone(t + 0.05, 900, 0.045, 0.08 * vol, 'square', 1200);
        break;
      case 'switch':
        this.tone(t, 280, 0.04, 0.08 * vol, 'square', 500);
        break;
      case 'hit':
        this.tone(t, 1380, 0.045, 0.13 * vol, 'sine', 1800);
        break;
      case 'headshot':
        this.tone(t, 1800, 0.08, 0.14 * vol, 'sine', 2400);
        this.tone(t + 0.05, 2600, 0.1, 0.1 * vol, 'sine', 3000);
        break;
      case 'kill':
        this.tone(t, 330, 0.08, 0.12 * vol, 'triangle', 660);
        this.tone(t + 0.08, 660, 0.16, 0.1 * vol, 'triangle', 990);
        break;
      case 'hurt':
        this.noise(t, 0.15, 0.22 * vol, 'lowpass', 700, 0.5);
        this.tone(t, 90, 0.18, 0.16 * vol, 'sawtooth', 45);
        break;
      case 'shield':
        this.tone(t, 640, 0.12, 0.08 * vol, 'sine', 1100);
        break;
      case 'jump':
        this.tone(t, 170, 0.16, 0.08 * vol, 'sine', 420);
        break;
      case 'land':
        this.noise(t, 0.08, 0.12 * vol, 'lowpass', 340, 0.5);
        break;
      case 'explosion':
        this.noise(t, 0.8, 0.7 * vol, 'lowpass', 700, 0.4);
        this.tone(t, 68, 0.8, 0.5 * vol, 'sawtooth', 24);
        break;
      case 'pickup':
        this.tone(t, 520, 0.07, 0.1 * vol, 'sine', 780);
        this.tone(t + 0.07, 780, 0.12, 0.09 * vol, 'sine', 1040);
        break;
      case 'wave':
        this.tone(t, 220, 0.3, 0.12 * vol, 'triangle', 440);
        this.tone(t + 0.25, 330, 0.4, 0.12 * vol, 'triangle', 660);
        this.tone(t + 0.5, 440, 0.5, 0.1 * vol, 'triangle', 880);
        break;
      case 'boss':
        this.tone(t, 55, 1.5, 0.3 * vol, 'sawtooth', 38);
        this.tone(t, 110, 1.2, 0.14 * vol, 'square', 55);
        this.noise(t, 1.3, 0.28 * vol, 'lowpass', 500, 0.4);
        break;
      case 'victory':
        [440, 554, 659, 880].forEach((f, i) => this.tone(t + i * 0.14, f, 0.5, 0.12 * vol, 'triangle', f * 1.01));
        break;
      case 'defeat':
        [330, 277, 220, 165].forEach((f, i) => this.tone(t + i * 0.18, f, 0.5, 0.13 * vol, 'sawtooth', f * 0.98));
        break;
      case 'ui':
        this.tone(t, 500, 0.035, 0.05 * vol, 'square', 700);
        break;
      case 'chat':
        this.tone(t, 840, 0.04, 0.045 * vol, 'square', 1040);
        break;
      case 'step':
        this.noise(t, 0.06, 0.06 * vol, 'lowpass', 500, 0.7);
        break;
      case 'portal':
        this.tone(t, 80, 1.5, 0.2 * vol, 'sine', 800);
        this.tone(t + 0.2, 120, 1.3, 0.1 * vol, 'triangle', 1200);
        break;
      default:
        break;
    }
  }
}
