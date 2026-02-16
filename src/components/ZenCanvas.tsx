import { useEffect, useRef, useState } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';
import { BubbleSystem } from '../game/BubbleSystem';
import { AudioSystem } from '../game/AudioSystem';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { PaymentComponent } from './PaymentComponent';
import { X, Gem } from 'lucide-react';
import { incrementGlobalPops, subscribeToGlobalPops } from '../services/db';

export const ZenCanvas = () => {
    const { videoRef, results, isLoading, startCamera } = useHandTracking();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioSystemRef = useRef<AudioSystem>(new AudioSystem());
    const requestRef = useRef<number | undefined>(undefined);

    const [quote, setQuote] = useState<string | null>(null);
    const [showPayment, setShowPayment] = useState(false);

    // Global Stats
    const [globalPops, setGlobalPops] = useState(0);
    const localPopsRef = useRef(0);

    // Mock Gemini API for Healing Quotes
    const fetchHealingQuote = () => {
        const quotes = [
            "Breathe in calm, breathe out stress.",
            "You are doing enough.",
            "Peace comes from within.",
            "Visualise your highest self.",
            "Let go of what you cannot control."
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        setQuote(randomQuote);

        // Hide after 3 seconds
        setTimeout(() => setQuote(null), 3000);
    };

    const bubbleSystemRef = useRef<BubbleSystem>(new BubbleSystem(
        () => {
            audioSystemRef.current.playPop();
            localPopsRef.current += 1; // Track locally
        },
        () => {
            audioSystemRef.current.playPop(0.5); // Golden Pop (Higher pitch variation?)
            localPopsRef.current += 5; // Golden bubbles count more?
            fetchHealingQuote();
        }
    ));

    // Sync Global Pops
    useEffect(() => {
        const unsubscribe = subscribeToGlobalPops((count) => setGlobalPops(count));

        // Push local pops every 5 seconds
        const syncInterval = setInterval(() => {
            if (localPopsRef.current > 0) {
                incrementGlobalPops(localPopsRef.current);
                localPopsRef.current = 0;
            }
        }, 5000);

        return () => {
            unsubscribe();
            clearInterval(syncInterval);
            // Push remaining on unmount
            if (localPopsRef.current > 0) incrementGlobalPops(localPopsRef.current);
        };
    }, []);

    // Initial setup
    useEffect(() => {
        const resize = () => {
            if (canvasRef.current && bubbleSystemRef.current) {
                const { clientWidth, clientHeight } = canvasRef.current;
                canvasRef.current.width = clientWidth;
                canvasRef.current.height = clientHeight;
                bubbleSystemRef.current.resize(clientWidth, clientHeight);
            }
        };

        window.addEventListener('resize', resize);
        // Delay initial resize to ensure element is sized
        setTimeout(resize, 100);

        if (isLoading) {
            startCamera();
        }

        // Resume Audio Context
        const resumeAudio = () => audioSystemRef.current.resume();
        window.addEventListener('click', resumeAudio);
        window.addEventListener('touchstart', resumeAudio);

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
        }
    }, [isLoading, startCamera]);

    const resultsRef = useRef<HandLandmarkerResult | null>(null);
    useEffect(() => {
        resultsRef.current = results;
    }, [results]);

    const calculateScreenCoordinates = (normalizedX: number, normalizedY: number) => {
        if (!videoRef.current || !canvasRef.current) return { x: 0, y: 0 };

        const video = videoRef.current;
        const canvas = canvasRef.current;

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        if (!videoWidth || !videoHeight) return { x: 0, y: 0 };

        // Calculate Scale to maintain aspect ratio (object-cover logic)
        const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);

        const scaledWidth = videoWidth * scale;
        const scaledHeight = videoHeight * scale;

        // Calculate offsets (centering)
        const offsetX = (canvasWidth - scaledWidth) / 2;
        const offsetY = (canvasHeight - scaledHeight) / 2;

        // Mirroring: MediaPipe x is 0(left) -> 1(right).
        // CSS transform scaleX(-1) mirrors the visual video.
        // If we want to interact with what we see, we need to treat the "visual" left as x=0.
        // Visual Video:
        // [   Cropped   |   Visible Canvas   |   Cropped   ]
        // 0             | offset             | offset+width (in scaled coords)

        // MediaPipe X (0..1) maps to Scaled X (0..scaledWidth)
        // ScaledX = normalizedX * scaledWidth
        // But since we are mirrored:
        // Visual X on screen = (1 - normalizedX) * scaledWidth + offsetX ??
        // Let's trace:
        // Real World Right Hand -> Camera Right Side -> Image X=1.
        // Mirrored Display -> User sees Hand on Right Side of Screen (Canvas X=Width).
        // So Image X=1 should map to Canvas X=Width.
        // Image X=0 (Left) -> Mirrored -> Screen Left (Canvas X=0).
        // Wait, scaleX(-1) flips the element.
        // Content at Image X=0 is drawn at Element X=Right-most?
        // No, standard CSS scaleX(-1) flips around center? Or origin? Usually center if transform-origin is 50% 50%.

        // Let's stick to the standard "Selfie Mirror" logic.
        // You raise right hand. Camera sees it on LEFT of image (subject's right). Image X ~ 0.
        // You want to see it on RIGHT of screen (mirror). Canvas X ~ Width.
        // Use normalizedX directly?
        // If X=0 (Left of image), we want it at Right of Screen? Yes.
        // So (1 - normalizedX).

        // Visual X in Scaled Video Space: (1 - normalizedX) * scaledWidth.
        // Visual X in Canvas Space: ((1 - normalizedX) * scaledWidth) + offsetX.

        const screenX = ((1 - normalizedX) * scaledWidth) + offsetX;
        const screenY = (normalizedY * scaledHeight) + offsetY;

        return { x: screenX, y: screenY };
    };

    useEffect(() => {
        const loop = () => {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                    // 1. Calculate Pointers
                    const pointers: { x: number, y: number }[] = [];
                    if (resultsRef.current && resultsRef.current.landmarks) {
                        for (const landmarks of resultsRef.current.landmarks) {
                            const indexTip = landmarks[8];
                            if (indexTip) {
                                const coords = calculateScreenCoordinates(indexTip.x, indexTip.y);
                                pointers.push(coords);
                            }
                        }
                    }

                    // 2. Update Physics
                    bubbleSystemRef.current.update(pointers);
                    bubbleSystemRef.current.draw(ctx);

                    // 3. Draw Debug Skeleton if needed
                    if (resultsRef.current && resultsRef.current.landmarks) {
                        // DrawingUtils draws directly to canvas using normalized coordinates context.
                        // But since correct mapping is complex with object-cover,
                        // Let's just draw generic circles at our calculated hit points to verify sync.

                        pointers.forEach(p => {
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
                            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; // Semi-transparent red
                            ctx.fill();
                            ctx.strokeStyle = "white";
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        });

                        // Optional: Keep original skeleton if it looks okay, but it might be misaligned.
                        // Let's comment out the potentially misleading skeleton for now
                        /*
                        ctx.save();
                        ctx.scale(-1, 1);
                        ctx.translate(-canvasRef.current.width, 0);
                        const drawingUtils = new DrawingUtils(ctx);
                        for (const landmarks of resultsRef.current.landmarks) {
                            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
                            drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
                        }
                        ctx.restore();
                        */
                    }
                }
            }
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current!);
    }, []);

    return (
        <div className="relative w-full h-full bg-slate-900">
            <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full object-cover -scale-x-100 opacity-80"
                autoPlay
                playsInline
                muted
            />

            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full object-cover"
                width={1280}
                height={720}
            />

            {/* UI Layer */}
            <div className="absolute top-4 left-4 z-20 text-white font-light backdrop-blur-sm bg-black/30 px-4 py-2 rounded-full">
                Global Pops: <span className="font-bold text-yellow-300">{globalPops.toLocaleString()}</span>
            </div>

            <div className="absolute top-4 right-4 z-20 flex gap-2">
                <button
                    onClick={() => setShowPayment(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500/80 hover:bg-yellow-500 text-white rounded-full backdrop-blur transition-all shadow-lg"
                >
                    <Gem size={18} />
                    <span>Premium</span>
                </button>
            </div>

            {/* Healing Quote Modal (Toast style) */}
            {quote && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                    <div className="bg-white/20 backdrop-blur-md border border-white/30 p-6 rounded-2xl shadow-2xl animate-bounce-in">
                        <p className="text-2xl font-light text-white text-center drop-shadow-md whitespace-nowrap">
                            {quote}
                        </p>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPayment && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="relative">
                        <button
                            onClick={() => setShowPayment(false)}
                            className="absolute -top-4 -right-4 p-2 bg-white rounded-full text-slate-900 hover:bg-gray-100 shadow-lg"
                        >
                            <X size={20} />
                        </button>
                        <PaymentComponent onSuccess={() => setShowPayment(false)} />
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-t-blue-500 rounded-full animate-spin"></div>
                        <p>Loading Zen Vision...</p>
                    </div>
                </div>
            )}
        </div>
    );
};
