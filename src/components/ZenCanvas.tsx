import { useEffect, useRef, useState } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';
import { BubbleSystem } from '../game/BubbleSystem';
import { AudioSystem } from '../game/AudioSystem';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { PaymentComponent } from './PaymentComponent';
import { X, Gem } from 'lucide-react';
import { incrementGlobalPops, subscribeToGlobalPops } from '../services/db';

export const ZenCanvas = () => {
    const { videoRef, results, isLoading, startCamera, error, modelStatus } = useHandTracking();
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
        const resumeAudio = () => {
            audioSystemRef.current.unlock();
            // Remove listeners once unlocked to save resources
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
        };
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

    const manualPointerRef = useRef<{ x: number, y: number } | null>(null);

    // Helper to get coordinates relative to canvas
    const getPointerPos = (e: React.PointerEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            // Touch Event
            if (e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                return null;
            }
        } else {
            // Mouse/Pointer Event
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Prevent default browser actions (scrolling, zooming)
        e.preventDefault();

        const pos = getPointerPos(e);
        if (pos) manualPointerRef.current = pos;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        const pos = getPointerPos(e);
        if (pos) manualPointerRef.current = pos;
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        manualPointerRef.current = null;
    };

    useEffect(() => {
        const loop = () => {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                    // 1. Calculate Pointers (Camera + Manual)
                    const pointers: { x: number, y: number }[] = [];

                    // Camera Input
                    if (resultsRef.current && resultsRef.current.landmarks) {
                        for (const landmarks of resultsRef.current.landmarks) {
                            const indexTip = landmarks[8];
                            if (indexTip) {
                                const coords = calculateScreenCoordinates(indexTip.x, indexTip.y);
                                pointers.push(coords);
                            }
                        }
                    }

                    // Manual Input (Touch/Mouse)
                    if (manualPointerRef.current) {
                        pointers.push(manualPointerRef.current);
                    }

                    // 2. Update Physics
                    bubbleSystemRef.current.update(pointers);
                    bubbleSystemRef.current.draw(ctx);

                    // 3. Draw Debug Visuals
                    // Draw Camera Pointer
                    if (resultsRef.current && resultsRef.current.landmarks) {
                        const cameraPointers: { x: number, y: number }[] = [];
                        for (const landmarks of resultsRef.current.landmarks) {
                            const indexTip = landmarks[8];
                            if (indexTip) {
                                cameraPointers.push(calculateScreenCoordinates(indexTip.x, indexTip.y));
                            }
                        }

                        cameraPointers.forEach(p => {
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
                            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; // Camera: Red
                            ctx.fill();
                            ctx.strokeStyle = "white";
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        });
                    }

                    // Draw Touch Pointer
                    if (manualPointerRef.current) {
                        ctx.beginPath();
                        ctx.arc(manualPointerRef.current.x, manualPointerRef.current.y, 15, 0, 2 * Math.PI);
                        ctx.fillStyle = "rgba(0, 255, 255, 0.5)"; // Touch: Cyan
                        ctx.fill();
                        ctx.strokeStyle = "white";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                }
            }
            requestRef.current = requestAnimationFrame(loop);
        };
        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current!);
    }, []);

    return (
        <div
            className="relative w-full h-full bg-slate-900 touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ touchAction: 'none' }}
        >
            <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full object-cover -scale-x-100 opacity-80 pointer-events-none"
                autoPlay
                playsInline
                muted
            />

            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
                width={1280}
                height={720}
            />

            {/* UI Layer */}
            <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2 select-none pointer-events-none">
                <div className="text-white font-bold backdrop-blur-md bg-black/40 px-5 py-2 rounded-full border border-white/10 shadow-lg">
                    POP: <span className="text-yellow-400 text-xl ml-1">{globalPops.toLocaleString()}</span>
                </div>
                {/* Mobile Debug Info */}
                <div className="text-xs text-white/70 bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                    Status: {modelStatus} <br />
                    Hands: {results?.landmarks?.length || 0}
                    {error && <span className="text-red-400 block font-bold">{error}</span>}
                </div>
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
                        <p className="text-sm text-gray-400">{modelStatus}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
