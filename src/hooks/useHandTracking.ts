import { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';

export const useHandTracking = () => {
    const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
    const [results, setResults] = useState<HandLandmarkerResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number | undefined>(undefined);

    const [error, setError] = useState<string | null>(null);
    const [modelStatus, setModelStatus] = useState<string>("Initializing...");

    useEffect(() => {
        const createLandmarker = async () => {
            try {
                setModelStatus("Loading Vision Tasks...");
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                setModelStatus("Loading Hand Model...");
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
                setModelStatus("Ready");
            } catch (err: any) {
                console.error("Error creating hand landmarker:", err);
                setError(`Model Error: ${err.message}`);
                setIsLoading(false);
                setModelStatus("Failed");
            }
        };

        createLandmarker();

        return () => {
            // Cleanup
        };
    }, []);


    const predictWebcam = useCallback(() => {
        if (!landmarker || !videoRef.current || !videoRef.current.videoWidth) return;

        // Ensure video is playing
        if (videoRef.current.paused || videoRef.current.ended) return;

        try {
            const startTimeMs = performance.now();
            const result = landmarker.detectForVideo(videoRef.current, startTimeMs);
            setResults(result);
        } catch (err: any) {
            console.error("Prediction error:", err);
            // setError(`Predict Error: ${err.message}`); // Don't spam UI
        }

        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker]);

    const startCamera = async () => {
        if (!videoRef.current) return;

        try {
            setModelStatus("Requesting Camera...");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
            setModelStatus("Camera Active");
        } catch (err: any) {
            console.error("Error accessing webcam:", err);
            setError(`Camera Error: ${err.message}`);
            setModelStatus("Camera Failed");
        }
    };

    return { videoRef, results, isLoading, startCamera, error, modelStatus };
};
