import React, { useState, useRef, useEffect } from "react";
import { motion } from 'framer-motion';
// The AssemblyAI SDK might have browser compatibility issues with direct streaming setup
// if it relies on Node.js streams. For direct browser microphone streaming,
// we often need to send raw audio buffers.
// For this example, we'll simulate the AssemblyAI client interaction,
// assuming a similar API for sending audio data.
// In a real application, you might need a custom WebSocket client for AssemblyAI
// or ensure their SDK fully supports browser-side audio streaming.

export default function AssemblyTest() {
  const [text, setText] = useState('Press "Start Recording" to begin speaking...');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const wsRef = useRef(null); // WebSocket reference for AssemblyAI

  const ASSEMBLY_AI_API_KEY = "2a15460e205c4495b7c56d0e744bc55b"; // Replace with your actual AssemblyAI API Key
  const ASSEMBLY_AI_WEB_SOCKET_URL = "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000";

  // Function to start recording and connect to AssemblyAI WebSocket
  const startRecording = async () => {
  setText("Connecting to AssemblyAI...");
  setIsRecording(true);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = stream;

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    // 🔁 STEP 1: Get temporary WebSocket token from AssemblyAI
    const response = await fetch("http://localhost:3000/api/get-credentials", {
  method: "POST",
});


    const data = await response.json();
    const { token } = data;
    console.log(response);
    console.log('token:');
    console.log(token);
    // ✅ Construct the real-time WS URL with token
    const realTimeUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`;
    wsRef.current = new WebSocket(realTimeUrl);

    wsRef.current.onopen = () => {
      console.log("Connected to AssemblyAI WebSocket");
      setText("Recording started. Speak now...");
      scriptProcessorRef.current.connect(audioContextRef.current.destination);
      source.connect(scriptProcessorRef.current);
    };

    wsRef.current.onmessage = (message) => {
      const response = JSON.parse(message.data);
      if (response.message_type === "PartialTranscript" || response.message_type === "FinalTranscript") {
        if (response.message_type === "FinalTranscript") {
          setText((prev) => prev + "\n" + response.text);
        } else {
          setText(response.text);
        }
      }
    };

    wsRef.current.onerror = (err) => {
      console.error("WebSocket error:", err);
      setText("WebSocket error. See console for details.");
      stopRecording();
    };

    wsRef.current.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setText("Recording stopped. Connection closed.");
      setIsRecording(false);
    };

    // Audio processing and sending to WS
    scriptProcessorRef.current.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcm[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(pcm.buffer);
      }
    };
  } catch (error) {
    console.error("Error accessing microphone or WebSocket:", error);
    setText("Error: Microphone or WebSocket issue. Check permissions or token.");
    setIsRecording(false);
  }
};


  // Function to stop recording and close WebSocket connection
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(e => console.error("Error closing audio context:", e));
      audioContextRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsRecording(false);
    setText('Recording stopped. Ready to record again.');
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRecording(); // Ensure resources are released when component unmounts
    };
  }, []);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white px-6 py-12 flex flex-col items-center justify-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="w-full max-w-2xl bg-slate-800 rounded-lg shadow-xl p-8 mb-8"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <h2 className="text-3xl font-extrabold text-center text-teal-400 mb-6">
          Live Speech Transcription
        </h2>
        <motion.p
          className="text-lg text-slate-300 text-center min-h-[100px] bg-slate-700 p-4 rounded-md overflow-auto"
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {text}
        </motion.p>
      </motion.div>

      <motion.button
        onClick={isRecording ? stopRecording : startRecording}
        className={`px-8 py-3 rounded-full font-bold text-white text-lg shadow-lg transform transition duration-200 ease-in-out
          ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-500 hover:bg-teal-600'}
        `}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </motion.button>
      <p className="mt-4 text-slate-400 text-sm">
      </p>
    </motion.div>
  );
}
