// ============================================================================
// SoundManager - Web Audio API based sound effects for iso-civ
// ============================================================================
// Singleton class that generates procedural sounds using oscillators.
// No external audio files needed - all sounds are synthesized in real-time.
// ============================================================================

export type SoundId =
  | 'combat_hit'
  | 'combat_death'
  | 'city_founded'
  | 'tech_complete'
  | 'turn_start'
  | 'notification'
  | 'victory'
  | 'golden_age';

class SoundManagerClass {
  private static instance: SoundManagerClass | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;
  private initialized: boolean = false;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): SoundManagerClass {
    if (!SoundManagerClass.instance) {
      SoundManagerClass.instance = new SoundManagerClass();
    }
    return SoundManagerClass.instance;
  }

  /**
   * Initialize the audio context. Must be called after user interaction
   * due to browser autoplay policies.
   */
  public init(): void {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  /**
   * Resume audio context if it's suspended (browser autoplay policy)
   */
  private async ensureResumed(): Promise<boolean> {
    if (!this.audioContext) {
      this.init();
    }
    if (!this.audioContext) return false;

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * Get current volume
   */
  public getVolume(): number {
    return this.volume;
  }

  /**
   * Set muted state
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.volume;
    }
  }

  /**
   * Get muted state
   */
  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Toggle muted state
   */
  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Play a sound effect by ID
   */
  public async playSound(soundId: SoundId): Promise<void> {
    const resumed = await this.ensureResumed();
    if (!resumed || !this.audioContext || !this.masterGain) return;

    switch (soundId) {
      case 'combat_hit':
        this.playCombatHit();
        break;
      case 'combat_death':
        this.playCombatDeath();
        break;
      case 'city_founded':
        this.playCityFounded();
        break;
      case 'tech_complete':
        this.playTechComplete();
        break;
      case 'turn_start':
        this.playTurnStart();
        break;
      case 'notification':
        this.playNotification();
        break;
      case 'victory':
        this.playVictory();
        break;
      case 'golden_age':
        this.playGoldenAge();
        break;
    }
  }

  /**
   * Combat hit: Short white noise burst with sine wave attack
   */
  private playCombatHit(): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // White noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialDecayTo(0.01, now + 0.08);

    // High-pass filter for sharp attack sound
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 2000;

    noiseSource.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(now);
    noiseSource.stop(now + 0.1);

    // Sharp sine wave attack
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Combat death: Low frequency thump with decay
   */
  private playCombatDeath(): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Low frequency thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.5);

    // Secondary rumble
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(60, now);
    osc2.frequency.exponentialRampToValueAtTime(30, now + 0.4);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(now);
    osc2.stop(now + 0.6);
  }

  /**
   * City founded: Triumphant major chord (C-E-G)
   */
  private playCityFounded(): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // C major chord: C4 (261.63), E4 (329.63), G4 (392.00)
    const frequencies = [261.63, 329.63, 392.00];
    const duration = 0.8;

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05 + i * 0.03);
      gain.gain.setValueAtTime(0.25, now + duration - 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + i * 0.03);
      osc.stop(now + duration + 0.1);
    });

    // Add a higher octave sparkle
    const sparkle = ctx.createOscillator();
    sparkle.type = 'sine';
    sparkle.frequency.setValueAtTime(523.25, now + 0.1); // C5

    const sparkleGain = ctx.createGain();
    sparkleGain.gain.setValueAtTime(0, now);
    sparkleGain.gain.linearRampToValueAtTime(0.15, now + 0.15);
    sparkleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    sparkle.connect(sparkleGain);
    sparkleGain.connect(this.masterGain);
    sparkle.start(now + 0.1);
    sparkle.stop(now + 0.6);
  }

  /**
   * Tech complete: Ascending arpeggio chime
   */
  private playTechComplete(): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Ascending arpeggio: C5, E5, G5, C6
    const frequencies = [523.25, 659.25, 783.99, 1046.50];
    const noteDelay = 0.1;

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * noteDelay);

      const gain = ctx.createGain();
      const startTime = now + i * noteDelay;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  /**
   * Turn start: Soft bell tone
   */
  private playTurnStart(): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Bell-like tone with harmonics
    const fundamental = 440; // A4
    const harmonics = [1, 2, 3, 4.2, 5.4]; // Slight inharmonicity for bell sound

    harmonics.forEach((harmonic, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * harmonic, now);

      const gain = ctx.createGain();
      const amplitude = 0.2 / (i + 1); // Higher harmonics are quieter
      gain.gain.setValueAtTime(amplitude, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5 - i * 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 1.5);
    });
  }

  /**
   * Notification: Short ping
   */
  private playNotification(): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Victory: Triumphant fanfare with multiple ascending notes
   */
  private playVictory(): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Fanfare sequence: ascending major scale with final chord
    const notes = [
      { freq: 392.00, time: 0, duration: 0.2 },      // G4
      { freq: 440.00, time: 0.15, duration: 0.2 },   // A4
      { freq: 493.88, time: 0.3, duration: 0.2 },    // B4
      { freq: 523.25, time: 0.45, duration: 0.4 },   // C5
      { freq: 587.33, time: 0.6, duration: 0.3 },    // D5
      { freq: 659.25, time: 0.8, duration: 0.5 },    // E5
      { freq: 783.99, time: 1.0, duration: 0.8 },    // G5 (final)
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      const gain = ctx.createGain();
      const startTime = now + note.time;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.03);
      gain.gain.setValueAtTime(0.3, startTime + note.duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + note.duration + 0.1);
    });

    // Final chord: C5, E5, G5
    const chordTime = now + 1.2;
    const chordFreqs = [523.25, 659.25, 783.99];
    chordFreqs.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, chordTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, chordTime);
      gain.gain.linearRampToValueAtTime(0.25, chordTime + 0.05);
      gain.gain.setValueAtTime(0.25, chordTime + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, chordTime + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(chordTime);
      osc.stop(chordTime + 1.3);
    });
  }

  /**
   * Golden Age: Shimmering ascending arpeggios with reverb-like effect
   */
  private playGoldenAge(): void {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Multiple ascending arpeggios for shimmering effect
    const baseFreqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major up two octaves
    const delays = [0, 0.05, 0.1]; // Slight delays for shimmer

    delays.forEach(delay => {
      baseFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay + i * 0.08);

        const gain = ctx.createGain();
        const startTime = now + delay + i * 0.08;
        const amplitude = 0.2 - delay * 2; // Later delays are quieter
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(amplitude, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6 - delay);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(startTime);
        osc.stop(startTime + 0.8);
      });
    });

    // Final sustained chord
    const chordTime = now + 0.6;
    const chordFreqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chordFreqs.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, chordTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, chordTime);
      gain.gain.linearRampToValueAtTime(0.15, chordTime + 0.1);
      gain.gain.setValueAtTime(0.15, chordTime + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, chordTime + 1.5);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(chordTime);
      osc.stop(chordTime + 1.6);
    });
  }

  /**
   * Cleanup audio context
   */
  public dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
      this.initialized = false;
    }
  }
}

// Polyfill for exponentialDecayTo which doesn't exist
declare global {
  interface AudioParam {
    exponentialDecayTo(value: number, endTime: number): void;
  }
}

// Add the polyfill method
if (typeof AudioParam !== 'undefined' && !AudioParam.prototype.exponentialDecayTo) {
  AudioParam.prototype.exponentialDecayTo = function(value: number, endTime: number) {
    this.exponentialRampToValueAtTime(Math.max(value, 0.0001), endTime);
  };
}

// Export singleton instance
export const SoundManager = SoundManagerClass.getInstance();
