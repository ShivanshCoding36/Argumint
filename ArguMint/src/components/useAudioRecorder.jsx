import { useState, useRef, useEffect, useCallback } from 'react';

const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  const [supportedMimeType, setSupportedMimeType] = useState('audio/webm'); // Default to WebM

  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunks = useRef([]);

  // Check for supported MIME types on component mount
  useEffect(() => {
    const checkMimeTypeSupport = () => {
      // Prioritize WebM with Opus, which is widely supported
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        setSupportedMimeType('audio/webm;codecs=opus');
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        setSupportedMimeType('audio/webm');
      }
      // You could add other fallbacks if needed, e.g., 'audio/ogg' for Firefox
      else {
        setError("Your browser does not support common audio recording formats.");
        setSupportedMimeType(null); // No supported type found
      }
    };

    if (window.MediaRecorder) {
      checkMimeTypeSupport();
    } else {
      setError("MediaRecorder API is not supported in this browser.");
      setSupportedMimeType(null);
    }
  }, []); // Run once on mount

  const startRecording = useCallback(async () => {
    if (!supportedMimeType) {
      setError("Cannot start recording: No supported audio format found for your browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Still request 16kHz, browser might resample if not supported
        },
      });
      audioStreamRef.current = stream;

      // Use the determined supported MIME type
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const recordedBlob = new Blob(audioChunks.current, { type: supportedMimeType });
        setAudioBlob(recordedBlob);
        audioChunks.current = [];
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError(`Recording error: ${event.error.name}`);
        setIsRecording(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAudioBlob(null);
      setError(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone permissions in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please ensure a microphone is connected.");
      } else {
        setError(`Could not access microphone: ${err.message}`);
      }
      setIsRecording(false);
    }
  }, [supportedMimeType]); // Re-run if supportedMimeType changes (unlikely after initial load)

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { isRecording, audioBlob, error, startRecording, stopRecording };
};

export default useAudioRecorder;