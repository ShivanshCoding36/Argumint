import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SarvamAIClient } from "sarvamai"; // NEW: Import SarvamAIClient

// Initialize SarvamAI Client using the environment variable
// IMPORTANT: Ensure VITE_SARVAM_API is set in your .env file (e.g., VITE_SARVAM_API=sk_YOUR_ACTUAL_KEY)
const sarvamClient = new SarvamAIClient({
    apiSubscriptionKey: import.meta.env.VITE_SARVAM_API // Accessing the API key from environment variables
});

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
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const eventSourceRef = useRef(null);
  const audioContextRef = useRef(null); // NEW: Ref for AudioContext
  const audioSourceRef = useRef(null); // NEW: Ref for AudioBufferSourceNode

  // NEW: Function to play audio from text using SarvamAI
  const playMessageAudio = async (text) => {
    if (!text) return;

    // Stop any currently playing audio
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
    }

    try {
        // Ensure AudioContext is initialized
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        const response = await sarvamClient.textToSpeech.convert({
            text: text,
            target_language_code: "en-IN",
            speaker: "vidya", // You can choose other speakers if available
            pitch: 0.1,
            pace: 0.9,
            loudness: 0.9,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: "bulbul:v2"
        });

        if (response && response.audio_content) {
            // Decode the base64 audio content
            const audioBlob = new Blob([Uint8Array.from(atob(response.audio_content), c => c.charCodeAt(0))], { type: 'audio/wav' });
            const arrayBuffer = await audioBlob.arrayBuffer();

            audioContextRef.current.decodeAudioData(arrayBuffer, (buffer) => {
                const source = audioContextRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContextRef.current.destination);
                source.start(0);
                audioSourceRef.current = source; // Store reference to current audio source

                source.onended = () => {
                    audioSourceRef.current = null; // Clear reference when audio finishes
                };
            }, (e) => {
                console.error("Error decoding audio data:", e);
            });
        } else {
            console.warn("SarvamAI response did not contain audio content.");
        }
    } catch (error) {
        console.error("Error converting text to speech with SarvamAI:", error);
    }
  };

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
        sessionStorage.setItem('currentTopic', '');
        setLoading(false);
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

  useEffect(() => {
    if (isTranscribing) {
      eventSourceRef.current = new EventSource('https://argumint.onrender.com/api/stream-transcribe/events');
      eventSourceRef.current.onmessage = e => {
        if (e.data) {
          setInput(prev => (prev ? prev + ' ' : '') + e.data);
        }
      };
      eventSourceRef.current.onerror = (err) => {
        console.error("EventSource failed:", err);
        eventSourceRef.current?.close();
        setIsTranscribing(false);
      };
    } else {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    }

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [isTranscribing]);

  const sendUserTurn = async () => {
    if (!input.trim() || aiThinking || roundCount >= MAX_ROUNDS) return;

    // NEW: Stop any playing audio when sending a message
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
    }

    if (isTranscribing) {
      setIsTranscribing(false);
      fetch('https://argumint.onrender.com/api/stream-transcribe/stop');
    }

    const newUserTurn = { user: input.trim() };
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
          difficulty
        })
      });

      const data = await await res.json();
      // Ensure we're updating the correct turn with the AI response
      const updatedRounds = currentHistory.map((item, index) =>
        index === currentHistory.length - 1 ? { ...item, ai: data.reply } : item
      );

      setRounds(updatedRounds);
      playMessageAudio(data.reply); // NEW: Play AI's response as audio

      const newRoundCount = roundCount + 1;
      setRoundCount(newRoundCount);

      if (newRoundCount >= MAX_ROUNDS) {
        const userText = updatedRounds.map(h => h.user).join('\n');
        const aiText = updatedRounds.map(h => h.ai).filter(Boolean).join('\n');

        const judgeRes = await fetch('https://argumint.onrender.com/api/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ debaterA: userText, debaterB: aiText ,topic: topic})
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
    if (!isTranscribing) {
      try {
        const response = await fetch('https://argumint.onrender.com/api/stream-transcribe/start');
        if (response.ok) {
          setIsTranscribing(true);
          console.log('Transcription started.');
        } else {
          console.error('Failed to start transcription:', response.statusText);
        }
      } catch (error) {
        console.error('Error starting transcription:', error);
      }
    } else {
      try {
        const response = await fetch('https://argumint.onrender.com/api/stream-transcribe/stop');
        if (response.ok) {
          setIsTranscribing(false);
          console.log('Transcription stopped.');
        } else {
          console.error('Failed to stop transcription:', response.statusText);
        }
      } catch (error) {
        console.error('Error stopping transcription:', error);
      }
    }
  };

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
                  key={i}
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
                    <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                      <p className="text-sm text-slate-400 mb-1">🤖 AI:</p>
                      <p>{r.ai}</p>
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
                placeholder="Type your argument..."
                className="flex-1 p-3 rounded-lg bg-white/10 border border-white/20 text-white"
                onKeyPress={e => e.key === 'Enter' && sendUserTurn()}
                disabled={aiThinking || isTranscribing}
              />
              <button
                onClick={handleMicClick}
                title={isTranscribing ? "Stop Speaking" : "Start Speaking"}
                disabled={aiThinking}
                className={`px-3 py-2 rounded-lg text-white text-xl ${isTranscribing ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-700'}`}
              >
                {isTranscribing ? '🔴' : '🎙️'}
              </button>
              <button
                onClick={sendUserTurn}
                disabled={aiThinking || isTranscribing}
                className="bg-teal-500 px-5 py-2 rounded-lg font-bold hover:bg-teal-600 disabled:opacity-50"
              >
                {aiThinking ? 'Thinking...' : 'Send'}
              </button>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
