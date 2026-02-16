export class AudioSystem {
    private audioContext: AudioContext;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    resume() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    playPop(variation: number = 0.1) {
        if (this.audioContext.state === 'suspended') return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        // Random Pitch Modulation
        const baseFreq = 400 + Math.random() * 200; // 400-600Hz
        const randomDetune = (Math.random() - 0.5) * variation * 1000; // +/- variation cents

        osc.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
        osc.detune.setValueAtTime(randomDetune, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15); // Quick drop "Pop" sound

        gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
    }
}
