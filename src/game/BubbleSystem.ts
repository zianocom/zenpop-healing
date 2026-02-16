

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
        // Increase spacing for cleaner look (radius * 2.2 instead of 1.5)
        const cols = Math.ceil(this.canvasWidth / (this.hexRadius * 2));
        const rows = Math.ceil(this.canvasHeight / (this.hexRadius * 2));

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Staggered grid (Honey comb style centers, but circles)
                const cx = col * (this.hexRadius * 2.2) + ((row % 2) * (this.hexRadius * 1.1));
                const cy = row * (this.hexRadius * 1.9);

                // Add some margin
                if (cx > -this.hexRadius && cx < this.canvasWidth + this.hexRadius &&
                    cy > -this.hexRadius && cy < this.canvasHeight + this.hexRadius) {

                    const isGolden = Math.random() < 0.05; // 5% chance

                    this.bubbles.push({
                        id: `${row}-${col}`,
                        x: cx,
                        y: cy,
                        radius: this.hexRadius - 5, // Gap between bubbles
                        color: isGolden ? '#FFD700' : `hsl(${Math.random() * 60 + 190}, 90%, 65%)`, // Gold or Blue/Purple/Pink
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
                        bubble.popProgress += 0.08; // Slower pop animation
                        bubble.scale = 1 + bubble.popProgress * 0.3; // Gentle expansion
                    }
                    return;
                }

                // Euclidean distance check
                const dx = point.x - bubble.x;
                const dy = point.y - bubble.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Hit box slightly larger than visual radius for better feel
                if (distance < bubble.radius * 1.2) {
                    this.popBubble(bubble);
                }
            });
        }
    }

    private popBubble(bubble: Bubble) {
        bubble.isPopped = true;
        // visual pop effect handled in draw
        if (this.onPop) this.onPop();
        if (bubble.type === 'golden' && this.onGoldenPop) this.onGoldenPop();
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.bubbles.forEach(bubble => {
            if (bubble.isPopped && bubble.popProgress >= 1) return;

            const r = bubble.radius * bubble.scale;

            // Opacity fade on pop
            let alpha = 0.8;
            if (bubble.isPopped) {
                alpha = 0.8 * (1 - bubble.popProgress);
            }

            ctx.globalAlpha = alpha;

            // 3D Sphere Gradient
            // Light source from top-left
            const gradient = ctx.createRadialGradient(
                bubble.x - r * 0.3, bubble.y - r * 0.3, r * 0.1, // Inner circle (highlight)
                bubble.x, bubble.y, r // Outer circle (body)
            );

            if (bubble.type === 'golden') {
                gradient.addColorStop(0, '#FFF5E1'); // Highlight
                gradient.addColorStop(0.3, '#FFD700'); // Gold
                gradient.addColorStop(1, '#B8860B'); // Shadow
            } else {
                // Parse base color (HSL) or use fixed logic? 
                // Simple 3D effect for varying HSL is tricky to "parse" back.
                // Let's just use white highlight + the bubble color + darker shadow
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); // Highlight
                gradient.addColorStop(0.3, bubble.color); // Body
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)'); // Shadow edge
            }

            ctx.beginPath();
            ctx.arc(bubble.x, bubble.y, r, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Shine Reflection (Glossy look)
            ctx.beginPath();
            ctx.arc(bubble.x - r * 0.3, bubble.y - r * 0.3, r * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();

            ctx.globalAlpha = 1;
        });
    }
}
