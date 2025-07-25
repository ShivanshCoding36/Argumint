import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAudioRecorder from '../components/useAudioRecorder';
import encodeWAV from 'audiobuffer-to-wav';
import axios from 'axios';

export default function DebateRoom() {
    const navigate = useNavigate();
    const [userId, setUserId] = useState('');
    const [difficulty, setDifficulty] = useState('medium');
    const [MAX_ROUNDS, setMAX_ROUNDS] = useState(3);
    const [input, setInput] = useState('');
    const [rounds, setRounds] = useState([]);
    const [roundCount, setRoundCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [aiThinking, setAiThinking] = useState(false);
    const [topic, setTopic] = useState('');
    const [settingsConfirmed, setSettingsConfirmed] = useState(false); // Store blobs with messageId as key
const [audioProgress, setAudioProgress] = useState(0);
const [audioDuration, setAudioDuration] = useState(0);



    // Speech-to-Text (STT) state and hook
    const { isRecording, audioBlob, error: micError, startRecording, stopRecording } = useAudioRecorder();
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [sttError, setSttError] = useState(null);

    // Text-to-Speech (TTS) state
    const currentAudioRef = useRef(null);
    const [playingMessageId, setPlayingMessageId] = useState(null);
    const [isDecodingAudio, setIsDecodingAudio] = useState(false); // New state to indicate if audio is being decoded/fetched
    // New state to store the current time of the paused audio
    const [pausedTime, setPausedTime] = useState(0);

    // Constants for SarvamAI TTS
    const SARVAM_TTS_ENDPOINT = 'https://api.sarvam.ai/text-to-speech';


    function splitText(text, maxChars = 300) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [];
  const chunks = [];
  let current = '';

  for (let sentence of sentences) {
    if ((current + sentence).length <= maxChars) {
      current += sentence;
    } else {
      if (current) chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

    // Function to play audio from text using SarvamAI
   const chunkAudioRefs = useRef({});
const currentChunkIndexRef = useRef(0);

const playMessageAudio = async (text, messageId, resume = false) => {
  setIsDecodingAudio(true);
  setPlayingMessageId(messageId);

  if (!resume) {
    // If not resuming, reset everything
    chunkAudioRefs.current[messageId] = [];
    currentChunkIndexRef.current = 0;
  }

  if (chunkAudioRefs.current[messageId].length === 0) {
    const chunks = splitText(text, 300);

    for (const chunk of chunks) {
      const payload = {
        text: chunk,
        target_language_code: "en-IN",
        speaker: "hitesh",
        pitch: 0.1,
        pace: 0.9,
        loudness: 0.9,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: "bulbul:v2"
      };

      const response = await axios.post(SARVAM_TTS_ENDPOINT, payload, {
        headers: {
          'api-subscription-key': import.meta.env.VITE_SARVAM_API,
          'Content-Type': 'application/json',
        }
      });

      const base64Audio = response.data.audios?.[0];
      if (!base64Audio) continue;

      const byteArray = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
      const audioBlob = new Blob([byteArray], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      chunkAudioRefs.current[messageId].push(audio);
    }
  }

  // Play the next chunk
  const playChunks = (index) => {
    const chunks = chunkAudioRefs.current[messageId];
    if (!chunks || index >= chunks.length) {
      setPlayingMessageId(null);
      currentAudioRef.current = null;
      setPausedTime(0);
      setAudioProgress(0);
      return;
    }

    const audio = chunks[index];
    currentAudioRef.current = audio;

    audio.onended = () => {
      currentChunkIndexRef.current = index + 1;
      playChunks(index + 1);
    };

    audio.onerror = () => {
      console.error("Audio playback error in chunk", index);
      playChunks(index + 1); // skip
    };

    audio.play();
  };

  playChunks(currentChunkIndexRef.current);

  setIsDecodingAudio(false);
};

const togglePlayPause = (text, messageId) => {
  if (playingMessageId === messageId && currentAudioRef.current?.paused === false) {
    currentAudioRef.current.pause();
    setPausedTime(currentAudioRef.current.currentTime);
  } else if (playingMessageId === messageId && currentAudioRef.current?.paused === true) {
    currentAudioRef.current.currentTime = pausedTime;
    currentAudioRef.current.play();
  } else {
    setPausedTime(0);
    playMessageAudio(text, messageId, false);
  }
};




    // Effect to fetch user and topic (UNMODIFIED)
    useEffect(() => {
        const fetchUserAndTopic = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return navigate('/login');
            }
            setUserId(user.id);

            const savedTopic = sessionStorage.getItem('currentTopic');

            if (savedTopic) {
                setTopic(savedTopic);
                setLoading(false);
                sessionStorage.setItem('currentTopic', '');
            } else {
                const { data } = await supabase
                    .from('profiles')
                    .select('interests')
                    .eq('id', user.id)
                    .single();

                const interest = data?.interests?.[0] || 'Technology';

                try {
                    const res = await fetch('https://argumint.onrender.com/api/generate-topic', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ interest })
                    });

                    const result = await res.json();
                    const generatedTopic = result.topic || 'No topic generated.';
                    setTopic(generatedTopic);
                    sessionStorage.setItem('currentTopic', generatedTopic);
                } catch (err) {
                    console.error('Failed to generate topic:', err);
                    setTopic('Failed to generate topic.');
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchUserAndTopic();
    }, [navigate]);

    // Effect for handling speech-to-text transcription (UNMODIFIED)
    useEffect(() => {
        const sendAudioToSarvam = async (blob) => {
            setSttError(null);
            setInput('Transcribing...');

            let audioToSend = blob;
            let filename = 'audio.wav';

            if (blob && !blob.type.includes('wav')) {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const wavBuffer = encodeWAV(audioBuffer);
                    audioToSend = new Blob([wavBuffer], { type: 'audio/wav' });
                } catch (conversionError) {
                    console.error('Error converting to WAV:', conversionError);
                    setSttError(`Failed to convert audio to WAV: ${conversionError.message}. Sarvam AI requires WAV.`);
                    setInput('');
                    setIsTranscribing(false);
                    return;
                }
            }

            const formData = new FormData();
            formData.append('file', audioToSend, filename);

            try {
                const response = await fetch('https://api.sarvam.ai/speech-to-text', {
                    method: 'POST',
                    headers: {
                        'api-subscription-key': import.meta.env.VITE_SARVAM_API,
                    },
                    body: formData,
                });

                const data = await response.json();

                if (response.ok && data && data.transcript) {
                    setInput(data.transcript);
                } else {
                    setInput('');
                    setSttError(data.detail || 'No transcript found in API response.');
                }
            } catch (err) {
                console.error('Error sending audio to Sarvam AI for STT:', err);
                setInput('');
                setSttError(`API Error: ${err.message}`);
            } finally {
                setIsTranscribing(false);
            }
        };

        if (!isRecording && audioBlob) {
            setIsTranscribing(true);
            sendAudioToSarvam(audioBlob);
        }
    }, [audioBlob, isRecording]);

    const sendUserTurn = async () => {
        // Disable sending if AI is thinking, transcribing, decoding audio, or max rounds reached
        if (!input.trim() || aiThinking || isTranscribing || isDecodingAudio || roundCount >= MAX_ROUNDS) return;

        // Stop any playing audio when sending a message
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.src = '';
            currentAudioRef.current = null;
            setPlayingMessageId(null);
            setPausedTime(0); // Reset paused time when user sends a message
        }

        if (isRecording) {
            stopRecording();
        }

        const newUserTurn = { user: input.trim(), id: Date.now() + '_user' };
        setRounds(prev => [...prev, newUserTurn]);
        setInput('');
        setAiThinking(true);

        const currentHistory = [...rounds, newUserTurn];

        try {
            const res = await fetch('https://argumint.onrender.com/api/ai-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: currentHistory,
                    Topic_: topic,
                    difficulty
                })
            });

            const data = await res.json();
            const newAiTurn = { ai: data.reply, id: Date.now() + '_ai' };
            const updatedRounds = currentHistory.map((item, index) =>
                index === currentHistory.length - 1 ? { ...item, ai: data.reply, id: newAiTurn.id } : item
            );

            setRounds(updatedRounds);
            // Pass 0 for startTime as it's a new AI response, always start from beginning
            playMessageAudio(data.reply, newAiTurn.id, 0);

            const newRoundCount = roundCount + 1;
            setRoundCount(newRoundCount);

            if (newRoundCount >= MAX_ROUNDS) {
                const userText = updatedRounds.map(h => h.user).join('\n');
                const aiText = updatedRounds.map(h => h.ai).filter(Boolean).join('\n');

                const judgeRes = await fetch('https://argumint.onrender.com/api/judge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ debaterA: userText, debaterB: aiText, topic: topic })
                });

                const judgment = await judgeRes.json();

                await supabase.from('debates').insert({
                    user_id: userId,
                    topic,
                    transcript_user: userText,
                    transcript_ai: aiText,
                    winner: judgment.winner,
                    score_user: judgment.score.debaterA,
                    score_ai: judgment.score.debaterB,
                    feedback_user: judgment.feedback.debaterA,
                    feedback_ai: judgment.feedback.debaterB
                });

                navigate('/results', {
                    state: {
                        winner: judgment.winner,
                        score: judgment.score,
                        feedback: judgment.feedback,
                        topic: topic,
                        isHumanDebate: false
                    }
                });
            }
        } catch (err) {
            console.error('Error during turn or judging:', err);
        } finally {
            setAiThinking(false);
        }
    };

    const handleMicClick = async () => {
        // Disable mic click if AI is thinking, transcribing, or decoding audio
        if (aiThinking || isTranscribing || isDecodingAudio) return;

        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
            setInput('');
            setSttError(null);
            // Also stop any playing audio when mic is activated
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current.src = '';
                currentAudioRef.current = null;
                setPlayingMessageId(null);
                setPausedTime(0); // Reset paused time when mic is used
            }
        }
    };

    // Consolidated disabled state for input and buttons
    const isInputDisabled = aiThinking || isTranscribing ||  isDecodingAudio;

    return (
        <motion.div
            className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white px-6 py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <motion.h1
                className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 mb-6"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                AI Debate Room ({roundCount}/{MAX_ROUNDS} rounds)
            </motion.h1>

            {loading ? (
                <p className="text-center text-lg text-cyan-300">Loading debate topic...</p>
            ) : (
                <>
                    <div className="text-center mb-6">
                        <strong className="text-cyan-400">Topic:</strong> {topic}
                    </div>

                    {!settingsConfirmed && (
                        <motion.div
                            className="flex flex-col md:flex-row items-center gap-4 mb-6 justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="bg-slate-800 p-2 rounded border border-white/20">
                                <option value="easy">🟢 Easy</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="hard">🔴 Hard</option>
                            </select>

                            <select value={MAX_ROUNDS} onChange={e => setMAX_ROUNDS(parseInt(e.target.value))} className="bg-slate-800 p-2 rounded border border-white/20">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <option key={n} value={n}>{n} Rounds</option>
                                ))}
                            </select>

                            <motion.button
                                className="bg-teal-500 px-5 py-2 rounded-lg font-bold hover:bg-teal-600 text-white"
                                onClick={() => setSettingsConfirmed(true)}
                                whileTap={{ scale: 0.96 }}
                            >
                                Set Settings ✅
                            </motion.button>
                        </motion.div>
                    )}

                    <div className="space-y-4 max-w-3xl mx-auto">
                        <AnimatePresence>
                            {rounds.map((r, i) => (
                                <motion.div
                                    key={r.id || i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="bg-cyan-500/10 p-4 rounded-xl border border-cyan-400/30 mb-2">
                                        <p className="text-sm text-cyan-300 mb-1">👤 You:</p>
                                        <p>{r.user}</p>
                                    </div>
                                    {r.ai && (
                                        <div className="bg-white/10 p-4 rounded-xl border border-white/20 relative">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-sm text-slate-400">🤖 AI:</p>
                                                <button
                                                    className="text-xl cursor-pointer text-teal-400 hover:text-teal-300 transition-colors"
                                                    title={playingMessageId === r.id ? "Pause Audio" : "Play Audio"}
                                                    onClick={() => togglePlayPause(r.ai, r.id)}
                                                    disabled={isDecodingAudio || (playingMessageId && playingMessageId !== r.id)}
                                                >
                                                    {playingMessageId === r.id ? '⏸️' : '▶️'}
                                                </button>
                                            </div>
                                            <p>{r.ai}</p>
                                            {playingMessageId === r.id && currentAudioRef.current && (
  <div className="flex items-center gap-3 mt-3">
    <input
      type="range"
      min={0}
      max={audioDuration || 0}
      value={audioProgress}
      onChange={(e) => {
        const newTime = Number(e.target.value);
        if (currentAudioRef.current) {
          currentAudioRef.current.currentTime = newTime;
          setAudioProgress(newTime);
        }
      }}
      className="w-full"
    />
    <button
      onClick={() => {
        if (currentAudioRef.current) {
          currentAudioRef.current.currentTime = 0;
          setPausedTime(0);
          setAudioProgress(0);
          currentAudioRef.current.play();
        }
      }}
      className="text-white bg-slate-600 px-2 py-1 rounded hover:bg-slate-500"
    >
      🔄
    </button>
  </div>
)}

                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {settingsConfirmed && roundCount < MAX_ROUNDS && (
                        <motion.div
                            className="flex gap-4 mt-6 max-w-3xl mx-auto"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder={isRecording ? "Listening..." : (isTranscribing ? "Transcribing..." : (isDecodingAudio ? "AI audio playing..." : "Type your argument..."))}
                                className="flex-1 p-3 rounded-lg bg-white/10 border border-white/20 text-white"
                                onKeyPress={e => e.key === 'Enter' && sendUserTurn()}
                                disabled={isInputDisabled}
                            />
                            <button
                                onClick={handleMicClick}
                                title={isRecording ? "Stop Speaking" : "Start Speaking"}
                                disabled={isInputDisabled}
                                className={`px-3 py-2 rounded-lg text-white text-xl ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-700'} ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isRecording ? '🔴' : '🎙️'}
                            </button>
                            <button
                                onClick={sendUserTurn}
                                disabled={isInputDisabled || input.trim() === ''}
                                className="bg-teal-500 px-5 py-2 rounded-lg font-bold hover:bg-teal-600 disabled:opacity-50"
                            >
                                {aiThinking ? 'Thinking...' : 'Send'}
                            </button>
                        </motion.div>
                    )}
                    {(micError || sttError) && (
                        <p className="text-red-400 text-center mt-4">Error: {micError || sttError}</p>
                    )}
                </>
            )}
        </motion.div>
    );
}
