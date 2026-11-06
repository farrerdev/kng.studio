// Soft shop sounds synthesised with Web Audio (no audio files to download or license): gentle
// background music, Min's meow, her purr and the bell on her collar. Browsers only allow audio after a user gesture, so
// the context starts on the first tap/key. Guests can mute it from the top bar; the choice is kept.

const STORAGE_KEY = "kng3d.sound";
/** Everything stays quiet: background ambience, not alerts. */
const MASTER_VOLUME = 0.6;
/** Music sits under everything else. */
const MUSIC_VOLUME = 0.7;
const BAR_SECONDS = 4.4;
/** Slow, warm progression (Fmaj7 – Em7 – Dm7 – Cmaj7), as MIDI notes. */
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
] as const;
const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

export type CatSounds = {
  meow: (volume: number) => void;
  purr: (seconds: number) => void;
  jingle: (volume: number) => void;
};

export class SoundBoard implements CatSounds {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabledFlag: boolean;
  private music: GainNode | null = null;
  private echo: DelayNode | null = null;
  private nextBar = 0;
  private bar = 0;

  constructor() {
    this.enabledFlag = readSetting() !== "off";
    // iOS mutes Web Audio with the ring/silent switch unless the page says it is "playback" audio.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
    // Different browsers count different events as the gesture that allows sound (iOS Safari
    // needs touchend/click, not pointerdown), so try on all of them until the context runs.
    const events = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
    const unlock = () => {
      if (document.visibilityState === "hidden") return;
      this.ensureContext();
      if (this.context && this.enabledFlag && this.context.state !== "running") void this.context.resume();
      if (this.context?.state === "running") for (const name of events) window.removeEventListener(name, unlock, true);
    };
    const armUnlock = () => {
      for (const name of events) window.addEventListener(name, unlock, true);
    };
    armUnlock();

    // Music belongs to this page only: leaving it (another app, another tab, locking the phone)
    // pauses everything and hands the phone's audio back, so other apps' music isn't cut off.
    const pause = () => {
      if (session) session.type = "ambient";
      if (this.context && this.context.state === "running") void this.context.suspend();
    };
    const comeBack = () => {
      if (document.visibilityState === "hidden") return;
      if (session) session.type = "playback";
      if (!this.context || !this.enabledFlag) return;
      // Some phones only resume after a fresh tap: try now, and again on the next touch.
      void this.context.resume().catch(() => undefined);
      armUnlock();
    };
    document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? pause() : comeBack()));
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", comeBack);
  }

  get enabled(): boolean {
    return this.enabledFlag;
  }

  setEnabled(enabled: boolean): void {
    this.enabledFlag = enabled;
    writeSetting(enabled ? "on" : "off");
    if (!this.context) {
      if (enabled) this.ensureContext(); // the toggle tap itself is a valid gesture
      return;
    }
    void (enabled ? this.context.resume() : this.context.suspend());
  }

  /** Short "mi-aaow": a buzzy source through two vowel formants with a rising-falling pitch. */
  meow(volume: number): void {
    const audio = this.ready();
    if (!audio) return;
    const { context, output } = audio;
    const t = context.currentTime;
    const pitch = 0.9 + Math.random() * 0.25;
    const length = 0.5 + Math.random() * 0.25;

    const source = context.createOscillator();
    source.type = "sawtooth";
    source.frequency.setValueAtTime(420 * pitch, t);
    source.frequency.linearRampToValueAtTime(760 * pitch, t + length * 0.25);
    source.frequency.linearRampToValueAtTime(560 * pitch, t + length * 0.75);
    source.frequency.linearRampToValueAtTime(430 * pitch, t + length);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3 * volume, t + 0.07);
    gain.gain.setValueAtTime(0.3 * volume, t + length * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);

    const mix = context.createGain();
    for (const [frequency, q, level] of [[950, 5, 1], [2100, 7, 0.55], [3300, 9, 0.2]] as const) {
      const formant = context.createBiquadFilter();
      formant.type = "bandpass";
      formant.frequency.setValueAtTime(frequency * 0.85, t);
      formant.frequency.linearRampToValueAtTime(frequency, t + length * 0.3);
      formant.Q.value = q;
      const formantGain = context.createGain();
      formantGain.gain.value = level;
      source.connect(formant).connect(formantGain).connect(mix);
    }
    mix.connect(gain).connect(output);
    source.start(t);
    source.stop(t + length + 0.05);
  }

  /** Low rumbling purr: filtered noise pulsing ~25 times a second. */
  purr(seconds: number): void {
    const audio = this.ready();
    if (!audio || !this.noise) return;
    const { context, output } = audio;
    const t = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 260;
    const pulse = context.createGain();
    pulse.gain.value = 0.5;
    const lfo = context.createOscillator();
    lfo.frequency.value = 24;
    const depth = context.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(pulse.gain);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(0.55, t + 0.4);
    envelope.gain.setValueAtTime(0.55, t + Math.max(0.5, seconds - 0.6));
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    source.connect(lowpass).connect(pulse).connect(envelope).connect(output);
    source.start(t);
    lfo.start(t);
    source.stop(t + seconds + 0.05);
    lfo.stop(t + seconds + 0.05);
  }

  /** Collar bell: two bright, quickly fading partials. */
  jingle(volume: number): void {
    const audio = this.ready();
    if (!audio) return;
    const { context, output } = audio;
    const t = context.currentTime;
    for (const [frequency, level, delay] of [[2950, 0.07, 0], [4420, 0.04, 0], [3100, 0.05, 0.09]] as const) {
      const tone = context.createOscillator();
      tone.type = "sine";
      tone.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(level * volume, t + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.35);
      tone.connect(gain).connect(output);
      tone.start(t + delay);
      tone.stop(t + delay + 0.4);
    }
  }

  private ready(): { context: AudioContext; output: GainNode } | null {
    if (!this.enabledFlag || !this.context || !this.master || this.context.state !== "running") return null;
    return { context: this.context, output: this.master };
  }

  private ensureContext(): void {
    if (this.context) return;
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = MASTER_VOLUME;
    this.master.connect(this.context.destination);
    const frames = this.context.sampleRate * 2;
    this.noise = this.context.createBuffer(1, frames, this.context.sampleRate);
    const channel = this.noise.getChannelData(0);
    for (let i = 0; i < frames; i += 1) channel[i] = Math.random() * 2 - 1;
    if (!this.enabledFlag) void this.context.suspend();
    this.startMusic();
  }

  // ---------- Music: soft pad chords with a few music-box notes and a gentle echo ----------

  private startMusic(): void {
    const context = this.context!;
    this.music = context.createGain();
    this.music.gain.value = MUSIC_VOLUME;
    this.music.connect(this.master!);
    this.echo = context.createDelay(1);
    this.echo.delayTime.value = 0.42;
    const feedback = context.createGain();
    feedback.gain.value = 0.32;
    const echoTone = context.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 2200;
    this.echo.connect(echoTone).connect(feedback).connect(this.echo);
    echoTone.connect(this.music);
    this.nextBar = context.currentTime + 0.3;
    // Schedule a little ahead so timing stays exact even if the page is busy.
    window.setInterval(() => this.scheduleMusic(), 300);
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || !this.music || context.state !== "running") return;
    // After a pause (sound off, tab hidden) pick up from now instead of catching up.
    if (this.nextBar < context.currentTime) this.nextBar = context.currentTime + 0.1;
    while (this.nextBar < context.currentTime + 1.5) {
      this.playBar(this.nextBar, CHORDS[this.bar % CHORDS.length]!);
      this.nextBar += BAR_SECONDS;
      this.bar += 1;
    }
  }

  private playBar(start: number, chord: readonly number[]): void {
    const context = this.context!;
    const pad = context.createBiquadFilter();
    pad.type = "lowpass";
    pad.frequency.value = 900;
    pad.connect(this.music!);
    for (const note of chord) {
      const tone = context.createOscillator();
      tone.type = "triangle";
      tone.frequency.value = midiToHz(note);
      tone.detune.value = (Math.random() - 0.5) * 8;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.1, start + 1.2);
      gain.gain.setValueAtTime(0.1, start + BAR_SECONDS - 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + BAR_SECONDS + 1.2);
      tone.connect(gain).connect(pad);
      tone.start(start);
      tone.stop(start + BAR_SECONDS + 1.3);
    }
    // Music-box notes from the chord, an octave or two up, on some beats.
    const beat = BAR_SECONDS / 4;
    for (let i = 0; i < 4; i += 1) {
      if (Math.random() < 0.45) continue;
      const note = chord[Math.floor(Math.random() * chord.length)]! + (Math.random() < 0.5 ? 12 : 24);
      const time = start + i * beat + (Math.random() < 0.3 ? beat / 2 : 0);
      const tone = context.createOscillator();
      tone.type = "sine";
      tone.frequency.value = midiToHz(note);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.12, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.6);
      tone.connect(gain);
      gain.connect(this.music!);
      gain.connect(this.echo!);
      tone.start(time);
      tone.stop(time + 1.7);
    }
  }
}

function readSetting(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSetting(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}
