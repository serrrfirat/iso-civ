/**
 * MusicManager - Procedural Background Music System using Web Audio API
 *
 * Generates ambient music with three layers:
 * - Bass drone: slow sine wave changing every 4 bars
 * - Melody: pentatonic scale notes played randomly
 * - Percussion: filtered noise for rhythm
 *
 * Supports intensity levels for peaceful vs tense gameplay
 */

type IntensityLevel = number; // 0 = peaceful, 1 = tense

interface MusicLayer {
  gainNode: GainNode;
  isActive: boolean;
}

// Pentatonic scale frequencies (C major pentatonic for peaceful, A minor pentatonic for tense)
const PEACEFUL_SCALE = [261.63, 293.66, 329.63, 392.00, 440.00]; // C D E G A
const TENSE_SCALE = [220.00, 246.94, 261.63, 329.63, 392.00]; // A B C E G (minor feel)

// Bass notes (one octave lower)
const PEACEFUL_BASS = [130.81, 146.83, 164.81]; // C D E
const TENSE_BASS = [110.00, 123.47, 130.81]; // A B C

class MusicManager {
  private static instance: MusicManager | null = null;

  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Layers
  private bassOscillator: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;
  private melodyGain: GainNode | null = null;
  private percussionGain: GainNode | null = null;

  // State
  private isPlaying = false;
  private intensity: IntensityLevel = 0;
  private targetIntensity: IntensityLevel = 0;
  private crossfadeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Timing
  private melodyInterval: ReturnType<typeof setInterval> | null = null;
  private percussionInterval: ReturnType<typeof setInterval> | null = null;
  private bassChangeInterval: ReturnType<typeof setInterval> | null = null;

  // Volume
  private volume = 0.3;

  private constructor() {}

  public static getInstance(): MusicManager {
    if (!MusicManager.instance) {
      MusicManager.instance = new MusicManager();
    }
    return MusicManager.instance;
  }

  private initAudioContext(): void {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();

    // Master gain for volume control
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.audioContext.destination);

    // Layer gains
    this.bassGain = this.audioContext.createGain();
    this.bassGain.gain.value = 0.4;
    this.bassGain.connect(this.masterGain);

    this.melodyGain = this.audioContext.createGain();
    this.melodyGain.gain.value = 0.3;
    this.melodyGain.connect(this.masterGain);

    this.percussionGain = this.audioContext.createGain();
    this.percussionGain.gain.value = 0.15;
    this.percussionGain.connect(this.masterGain);
  }

  /**
   * Start the music system
   */
  public async start(): Promise<void> {
    if (this.isPlaying) return;

    this.initAudioContext();

    if (!this.audioContext) return;

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isPlaying = true;

    // Start all layers
    this.startBassLayer();
    this.startMelodyLayer();
    this.startPercussionLayer();
  }

  /**
   * Stop the music system
   */
  public stop(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    // Stop bass oscillator
    if (this.bassOscillator) {
      this.bassOscillator.stop();
      this.bassOscillator.disconnect();
      this.bassOscillator = null;
    }

    // Clear intervals
    if (this.melodyInterval) {
      clearInterval(this.melodyInterval);
      this.melodyInterval = null;
    }
    if (this.percussionInterval) {
      clearInterval(this.percussionInterval);
      this.percussionInterval = null;
    }
    if (this.bassChangeInterval) {
      clearInterval(this.bassChangeInterval);
      this.bassChangeInterval = null;
    }
    if (this.crossfadeTimeout) {
      clearTimeout(this.crossfadeTimeout);
      this.crossfadeTimeout = null;
    }
  }

  /**
   * Set intensity level with crossfade
   * @param level 0 = peaceful, 1 = tense
   */
  public setIntensity(level: IntensityLevel): void {
    this.targetIntensity = Math.max(0, Math.min(1, level));

    if (!this.audioContext || !this.isPlaying) {
      this.intensity = this.targetIntensity;
      return;
    }

    // Crossfade over 2 seconds
    const crossfadeDuration = 2;
    const steps = 20;
    const stepTime = (crossfadeDuration * 1000) / steps;
    const intensityDiff = this.targetIntensity - this.intensity;
    const intensityStep = intensityDiff / steps;

    let currentStep = 0;

    const crossfade = () => {
      currentStep++;
      this.intensity += intensityStep;

      if (currentStep >= steps) {
        this.intensity = this.targetIntensity;
        this.crossfadeTimeout = null;
        return;
      }

      this.updateLayerParameters();
      this.crossfadeTimeout = setTimeout(crossfade, stepTime);
    };

    if (this.crossfadeTimeout) {
      clearTimeout(this.crossfadeTimeout);
    }

    crossfade();
  }

  /**
   * Set master volume
   * @param vol 0.0 to 1.0
   */
  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.audioContext.currentTime,
        0.1
      );
    }
  }

  /**
   * Get current volume
   */
  public getVolume(): number {
    return this.volume;
  }

  /**
   * Check if music is currently playing
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Play a triumphant swell for victory
   */
  public playVictorySwell(): void {
    if (!this.audioContext || !this.masterGain) {
      this.initAudioContext();
    }

    if (!this.audioContext || !this.masterGain) return;

    const now = this.audioContext.currentTime;

    // Create a chord: C major triad
    const frequencies = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

    frequencies.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.3);
      gain.gain.linearRampToValueAtTime(0.15, now + 1.5);
      gain.gain.linearRampToValueAtTime(0, now + 3);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + i * 0.1);
      osc.stop(now + 3.5);
    });

    // Add a higher arpeggio
    const arpeggioNotes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    arpeggioNotes.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const noteStart = now + 0.5 + i * 0.15;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.15, noteStart + 0.1);
      gain.gain.linearRampToValueAtTime(0, noteStart + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(noteStart);
      osc.stop(noteStart + 0.7);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Private layer implementations
  // ─────────────────────────────────────────────────────────────────

  private startBassLayer(): void {
    if (!this.audioContext || !this.bassGain) return;

    const playBassNote = () => {
      if (!this.audioContext || !this.bassGain || !this.isPlaying) return;

      // Stop previous oscillator
      if (this.bassOscillator) {
        const oldOsc = this.bassOscillator;
        const oldGain = this.audioContext.createGain();
        oldGain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        oldGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
        oldOsc.disconnect();
        oldOsc.connect(oldGain);
        oldGain.connect(this.bassGain);
        setTimeout(() => {
          oldOsc.stop();
          oldOsc.disconnect();
        }, 600);
      }

      // Select bass note based on intensity
      const bassScale = this.intensity > 0.5 ? TENSE_BASS : PEACEFUL_BASS;
      const noteIndex = Math.floor(Math.random() * bassScale.length);
      const frequency = bassScale[noteIndex];

      // Create new oscillator
      this.bassOscillator = this.audioContext.createOscillator();
      this.bassOscillator.type = 'sine';
      this.bassOscillator.frequency.value = frequency;

      // Add subtle vibrato for tense mode
      if (this.intensity > 0.5) {
        const vibrato = this.audioContext.createOscillator();
        const vibratoGain = this.audioContext.createGain();
        vibrato.frequency.value = 4 + this.intensity * 2;
        vibratoGain.gain.value = 2;
        vibrato.connect(vibratoGain);
        vibratoGain.connect(this.bassOscillator.frequency);
        vibrato.start();
      }

      const fadeIn = this.audioContext.createGain();
      fadeIn.gain.setValueAtTime(0, this.audioContext.currentTime);
      fadeIn.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + 0.3);

      this.bassOscillator.connect(fadeIn);
      fadeIn.connect(this.bassGain);
      this.bassOscillator.start();
    };

    playBassNote();

    // Change bass note every 4 bars (assuming ~120 BPM, 4 beats per bar = 8 seconds)
    // Slower for peaceful, faster for tense
    const getInterval = () => 8000 - this.intensity * 3000; // 8s peaceful, 5s tense

    const scheduleNext = () => {
      if (!this.isPlaying) return;
      this.bassChangeInterval = setTimeout(() => {
        playBassNote();
        scheduleNext();
      }, getInterval());
    };

    scheduleNext();
  }

  private startMelodyLayer(): void {
    if (!this.audioContext || !this.melodyGain) return;

    const playMelodyNote = () => {
      if (!this.audioContext || !this.melodyGain || !this.isPlaying) return;

      // Select scale based on intensity
      const scale = this.intensity > 0.5 ? TENSE_SCALE : PEACEFUL_SCALE;
      const noteIndex = Math.floor(Math.random() * scale.length);
      const frequency = scale[noteIndex];

      // Occasionally play an octave higher
      const octaveUp = Math.random() > 0.7;
      const finalFreq = octaveUp ? frequency * 2 : frequency;

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      // Use different wave types based on intensity
      osc.type = this.intensity > 0.5 ? 'sawtooth' : 'triangle';
      osc.frequency.value = finalFreq;

      const now = this.audioContext.currentTime;
      const noteDuration = 0.4 - this.intensity * 0.15; // Shorter notes when tense

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3 - this.intensity * 0.1, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.2 - this.intensity * 0.05, now + noteDuration * 0.3);
      gain.gain.linearRampToValueAtTime(0, now + noteDuration);

      // Add filter for smoother sound
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000 - this.intensity * 500;
      filter.Q.value = 1;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.melodyGain);

      osc.start(now);
      osc.stop(now + noteDuration + 0.1);
    };

    // Play melody notes at random intervals
    const scheduleNext = () => {
      if (!this.isPlaying) return;

      // Interval: 1-2 seconds peaceful, 0.5-1.5 seconds tense
      const minInterval = 1000 - this.intensity * 500;
      const maxInterval = 2000 - this.intensity * 500;
      const interval = minInterval + Math.random() * (maxInterval - minInterval);

      this.melodyInterval = setTimeout(() => {
        playMelodyNote();
        scheduleNext();
      }, interval);
    };

    // Initial delay before first note
    setTimeout(() => {
      playMelodyNote();
      scheduleNext();
    }, 500);
  }

  private startPercussionLayer(): void {
    if (!this.audioContext || !this.percussionGain) return;

    const playPercussion = () => {
      if (!this.audioContext || !this.percussionGain || !this.isPlaying) return;

      // Create filtered noise for percussion
      const bufferSize = this.audioContext.sampleRate * 0.1;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000 + this.intensity * 2000; // Higher freq when tense
      filter.Q.value = 5;

      // Envelope
      const gain = this.audioContext.createGain();
      const now = this.audioContext.currentTime;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2 + this.intensity * 0.2, now + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.percussionGain);

      noise.start(now);
      noise.stop(now + 0.15);
    };

    // Schedule percussion hits
    const scheduleNext = () => {
      if (!this.isPlaying) return;

      // Percussion rate: every 0.8-1.2s peaceful, every 0.3-0.6s tense
      const minInterval = 800 - this.intensity * 500;
      const maxInterval = 1200 - this.intensity * 600;
      const interval = minInterval + Math.random() * (maxInterval - minInterval);

      this.percussionInterval = setTimeout(() => {
        playPercussion();
        scheduleNext();
      }, interval);
    };

    // Initial delay
    setTimeout(() => {
      playPercussion();
      scheduleNext();
    }, 1000);
  }

  private updateLayerParameters(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Adjust percussion volume based on intensity
    if (this.percussionGain) {
      const percVolume = 0.1 + this.intensity * 0.15;
      this.percussionGain.gain.setTargetAtTime(percVolume, now, 0.1);
    }

    // Melody layer adjusts slightly
    if (this.melodyGain) {
      const melodyVolume = 0.3 - this.intensity * 0.05;
      this.melodyGain.gain.setTargetAtTime(melodyVolume, now, 0.1);
    }
  }
}

// Export singleton getter
export function getMusicManager(): MusicManager {
  return MusicManager.getInstance();
}

export { MusicManager };
export type { IntensityLevel };
