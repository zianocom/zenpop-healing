import { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';

export const useHandTracking = () => {
    const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
    const [results, setResults] = useState<HandLandmarkerResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const createLandmarker = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                const handLandmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });
                setLandmarker(handLandmarker);
                setIsLoading(false);
            } catch (error) {
                console.error("Error creating hand landmarker:", error);
                setIsLoading(false);
            }
        };

        createLandmarker();

        return () => { // Cleanup not explicitly needed for singleton but good practice
            // landmarker?.close(); // HandLandmarker doesn't have close() in all versions, checking docs
        };
    }, []);


    const predictWebcam = useCallback(() => {
        if (!landmarker || !videoRef.current || !videoRef.current.videoWidth) return;

        // Ensure video is playing
        if (videoRef.current.paused || videoRef.current.ended) return;

        const startTimeMs = performance.now();
        const result = landmarker.detectForVideo(videoRef.current, startTimeMs);
        setResults(result);

        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker]);

    const startCamera = async () => {
        if (!videoRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
        } catch (err) {
            console.error("Error accessing webcam:", err);
        }
    };

    // Clean up animation frame on unmount
    useEffect(() => {
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        }
    }, []);

    return { videoRef, results, isLoading, startCamera };
};
