export class AudioSystem {
    private audioContext: AudioContext;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    async unlock() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // Mobile browsers sometimes need a dummy sound played to fully unlock
        const buffer = this.audioContext.createBuffer(1, 1, 22050);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
    }

    playPop(volume: number = 0.5) {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        // Realistic Bubble Wrap "Pop"
        // Needs a sharp attack and very quick frequency drop
        const t = this.audioContext.currentTime;

        // Higher base pitch, rapid drop
        // Variation: 600-800Hz base
        const baseFreq = 700 + Math.random() * 200;

        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.08); // Fast sweep down

        // Envelope
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume * 1.5, t + 0.01); // Instant attack
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); // Short decay

        osc.start(t);
        osc.stop(t + 0.15);
    }
}
