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

        // Random Pitch Modulation
        const baseFreq = 400 + Math.random() * 200; // 400-600Hz
        const randomDetune = (Math.random() - 0.5) * 1000; // +/- variation cents

        osc.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
        osc.detune.setValueAtTime(randomDetune, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15); // Quick drop "Pop" sound

        gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
    }
}
