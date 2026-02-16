

interface Bubble {
    id: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    type: 'normal' | 'golden';
    isPopped: boolean;
    scale: number;
    popProgress: number;
}

export class BubbleSystem {
    private bubbles: Bubble[] = [];
    private canvasWidth: number = 0;
    private canvasHeight: number = 0;
    private hexRadius: number = 40; // Size of hex bubbles

    private onPop: (() => void) | null = null;
    private onGoldenPop: (() => void) | null = null;

    constructor(onPop?: () => void, onGoldenPop?: () => void) {
        if (onPop) this.onPop = onPop;
        if (onGoldenPop) this.onGoldenPop = onGoldenPop;
    }

    resize(width: number, height: number) {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.initBubbles();
    }

    private initBubbles() {
        this.bubbles = [];
        const cols = Math.ceil(this.canvasWidth / (this.hexRadius * 1.5));
        const rows = Math.ceil(this.canvasHeight / (this.hexRadius * Math.sqrt(3)));

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Correct honeycomb math:
                // x spacing = 1.5 * R
                // y spacing = sqrt(3) * R
                // odd rows shifted by 0? No, usually odd cols shifted or odd rows.
                // Let's use simple row shift.

                const cx = col * (this.hexRadius * Math.sqrt(3)) + ((row % 2) * (this.hexRadius * Math.sqrt(3) / 2));
                const cy = row * (this.hexRadius * 1.5);

                // Add some margin
                if (cx > -this.hexRadius && cx < this.canvasWidth + this.hexRadius &&
                    cy > -this.hexRadius && cy < this.canvasHeight + this.hexRadius) {

                    const isGolden = Math.random() < 0.05; // 5% chance

                    this.bubbles.push({
                        id: `${row}-${col}`,
                        x: cx,
                        y: cy,
                        radius: this.hexRadius - 2, // Slight gap
                        color: isGolden ? '#FFD700' : `hsl(${Math.random() * 60 + 200}, 90%, 70%)`, // Gold or Blue-ish pastel
                        type: isGolden ? 'golden' : 'normal',
                        isPopped: false,
                        scale: 1,
                        popProgress: 0
                    });
                }
            }
        }
    }

    update(pointers: { x: number, y: number }[]) {
        for (const point of pointers) {
            this.bubbles.forEach(bubble => {
                if (bubble.isPopped) {
                    if (bubble.popProgress < 1) {
                        bubble.popProgress += 0.1;
                        bubble.scale = 1 + bubble.popProgress * 0.5;
                    }
                    return;
                }

                // Euclidean distance check
                const dx = point.x - bubble.x;
                const dy = point.y - bubble.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < bubble.radius) {
                    this.popBubble(bubble);
                }
            });
        }
    }

    private popBubble(bubble: Bubble) {
        bubble.isPopped = true;
        bubble.color = "#FFFFFF"; // Flash white or change
        if (this.onPop) this.onPop();
        if (bubble.type === 'golden' && this.onGoldenPop) this.onGoldenPop();
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.bubbles.forEach(bubble => {
            if (bubble.isPopped && bubble.popProgress >= 1) return; // Don't draw fully popped

            ctx.beginPath();
            // Draw Hexagon or Circle? "Hexagonal (Honeycomb) Tiling" was requested.
            // Drawing a hexagon:
            const sides = 6;
            const r = bubble.radius * (bubble.isPopped ? 1 - bubble.popProgress : 1); // Shrink on pop? or Expand?
            // Let's fade out: globalAlpha?
            if (bubble.isPopped) {
                ctx.globalAlpha = 1 - bubble.popProgress;
            } else {
                ctx.globalAlpha = 0.6;
            }

            ctx.fillStyle = bubble.color;
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;

            for (let i = 0; i < sides; i++) {
                const angle = (i * 2 * Math.PI / sides) - (Math.PI / 6); // Rotate to point up
                const px = bubble.x + r * Math.cos(angle);
                const py = bubble.y + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.globalAlpha = 1; // Reset
        });
    }
}
