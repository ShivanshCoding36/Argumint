import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
import { SarvamAIClient } from "sarvamai";

// Initialize SarvamAI Client using the environment variable
// IMPORTANT: Ensure VITE_SARVAM_API is set in your .env file (e.g., VITE_SARVAM_API=sk_YOUR_ACTUAL_KEY)
const sarvamClient = new SarvamAIClient({
    apiSubscriptionKey: import.meta.env.VITE_SARVAM_API // Accessing the API key from environment variables
});

export default function HumanDebateRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(''); // 'A' or 'B'
  const [userNameMap, setUserNameMap] = useState({});
  const [typingOpponent, setTypingOpponent] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [topic, setTopic] = useState('');
  const [MAX_ROUNDS, setMAX_ROUNDS] = useState(3); // Default to 3 rounds, will be overridden by DB if set
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);
  const [settingsLocked, setSettingsLocked] = useState(false); // NEW STATE: To control visibility of settings
  const [loadingRoomData, setLoadingRoomData] = useState(true);

  const messagesEndRef = useRef(null);
  const broadcastTypingRef = useRef(null);
  const eventSourceRef = useRef(null);
  const currentUserNameMap = useRef({});
  const currentTopicRef = useRef('');
  const currentUserRoleRef = useRef('');
  const audioContextRef = useRef(null); // Ref for AudioContext
  const audioSourceRef = useRef(null); // Ref for AudioBufferSourceNode

  const totalTurnsNeeded = MAX_ROUNDS * 2;

  // Function to play audio from text using SarvamAI
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
            speaker: "hitesh",
            pitch: 0.1,
            pace: 0.9,
            loudness: 0.9,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: "bulbul"
        });
        console.log("Full Sarvam Response:", response);

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


  // Determines if the current user can send a message based on turn order and debate progress
  const canSend = () => {
    // Cannot send if user is not identified, role not assigned, or debate is over
    // Also cannot send if settings are not confirmed yet
    if (!userId || !userRole || messages.length >= totalTurnsNeeded || !settingsConfirmed) return false;

    // If no messages yet, only Debater A can start
    if (messages.length === 0) {
      return userRole === 'A';
    } else {
      // Otherwise, it's the turn of the role that didn't send the last message
      const lastMsg = messages[messages.length - 1];
      return lastMsg.role !== userRole;
    }
  };

  // Scrolls to the bottom of the messages whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial setup effect: fetches user, topic, messages, and assigns roles
  useEffect(() => {
    const init = async () => {
      setLoadingRoomData(true);

      // Authenticate user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingRoomData(false);
        return navigate('/login');
      }
      setUserId(user.id);

      // --- Topic and MAX_ROUNDS Handling: Fetch existing or generate and create room ---
      let topicFetched = '';
      let maxRoundsFetched = null;
      let dbSettingsLocked = false;

      // 1. Try to fetch from Supabase 'rooms' table
      const { data: existingRoom, error: fetchRoomError } = await supabase
        .from('rooms')
        .select('topic, max_rounds, settings_locked')
        .eq('id', roomId)
        .maybeSingle();

      if (fetchRoomError && fetchRoomError.code !== 'PGRST116') {
        console.error("Error checking room existence:", fetchRoomError);
        topicFetched = 'Error fetching topic.';
      } else if (existingRoom) {
        topicFetched = existingRoom.topic;
        maxRoundsFetched = existingRoom.max_rounds;
        dbSettingsLocked = existingRoom.settings_locked;

        setSettingsLocked(dbSettingsLocked);
        if (maxRoundsFetched) {
          setMAX_ROUNDS(maxRoundsFetched);
        }
        if (dbSettingsLocked || maxRoundsFetched) {
          setSettingsConfirmed(true);
        }
      } else {
        // Room does NOT exist in DB, proceed to check session storage
        const savedTopic = sessionStorage.getItem(`currentTopic`); // Using 'currentTopic' as per your DebateRoom example

        if (savedTopic) {
          // 2. Found in Session Storage, use it and persist to DB
          topicFetched = savedTopic;
          try {
            const { error: insertError } = await supabase
              .from('rooms')
              .insert({ id: roomId, topic: topicFetched })
              .select()
              .maybeSingle();

            if (insertError) {
              console.error("Room creation from session storage failed:", insertError);
              topicFetched = 'Failed to persist topic from session. Generating new.';
              sessionStorage.removeItem(`currentTopic`); // Clear bad session topic
              await generateAndInsertTopic(user.id);
            }
          } catch (err) {
            console.error('Error persisting topic from session:', err);
            topicFetched = 'Failed to persist topic from session. Generating new.';
            sessionStorage.removeItem(`currentTopic`);
            await generateAndInsertTopic(user.id);
          }
        } else {
          // 3. Not in Session Storage, Generate New Topic
          topicFetched = await generateAndInsertTopic(user.id);
        }
      }

      setTopic(topicFetched);
      currentTopicRef.current = topicFetched;

      // Helper function to generate and insert topic into DB
      async function generateAndInsertTopic(currentUserId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('interests')
          .eq('id', currentUserId)
          .single();

        const interest = profileData?.interests?.[0] || 'Technology';
        try {
          const res = await fetch('https://argumint.onrender.com/api/generate-topic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interest })
          });
          const result = await res.json();
          const generatedTopic = result.topic || 'No topic generated.';

          const { error: insertError } = await supabase
            .from('rooms')
            .insert({ id: roomId, topic: generatedTopic })
            .select()
            .maybeSingle();

          if (insertError) {
            console.error("Room creation failed after generation:", insertError);
            return 'Failed to create room with topic.';
          }
          sessionStorage.setItem(`currentTopic`, generatedTopic); // Save to session for immediate use
          return generatedTopic;
        } catch (err) {
          console.error('Failed to generate topic:', err);
          return 'Failed to generate topic.';
        }
      }

      // --- Fetch initial messages for the room ---
      const { data: initialMessages } = await supabase
        .from('debates_live')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at');

      setMessages(initialMessages || []);

      // --- Determine user role ('A' or 'B') for the current user ---
      const roles = {};
      initialMessages.forEach(m => {
        if (!roles[m.user_id]) roles[m.user_id] = m.role;
      });

      if (roles[user.id]) {
        setUserRole(roles[user.id]);
        currentUserRoleRef.current = roles[user.id];
      } else {
        const assigned = Object.values(roles).includes('A') ? 'B' : 'A';
        setUserRole(assigned);
        currentUserRoleRef.current = assigned;
      }

      // --- Fetch and map user names for display ---
      const userIds = [...new Set(initialMessages.map(m => m.user_id))];
      if (!userIds.includes(user.id)) userIds.push(user.id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const map = {};
      profiles?.forEach(p => map[p.id] = p.name);
      setUserNameMap(map);
      currentUserNameMap.current = map;

      setLoadingRoomData(false);
    };

    init();
  }, [roomId, navigate]);

  // Effect for real-time message updates and typing indicators via Supabase channels
  useEffect(() => {
    if (!userId || !userRole || loadingRoomData) return;

    currentUserNameMap.current = userNameMap;
    currentUserRoleRef.current = userRole;

    const channel = supabase
      .channel(`debate-room-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'debates_live',
        filter: `room_id=eq.${roomId}`
      }, async payload => {
        const msg = payload.new;

        // Play audio for opponent's messages
        if (msg.user_id !== userId) {
            playMessageAudio(msg.message);
        }

        if (!currentUserNameMap.current[msg.user_id]) {
          const { data } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', msg.user_id)
            .limit(1)
            .maybeSingle();

          if (data?.name) {
            setUserNameMap(prev => {
              const newMap = { ...prev, [msg.user_id]: data.name };
              currentUserNameMap.current = newMap;
              return newMap;
            });
          }
        }

        setMessages(prev => {
          const updated = [...prev, msg];

          if (updated.length === MAX_ROUNDS * 2 && currentUserRoleRef.current === 'A') {
            const aTranscript = updated.filter(m => m.role === 'A').map(m => m.message).join('\n');
            const bTranscript = updated.filter(m => m.role === 'B').map(m => m.message).join('\n');
            const debaterA_id = updated.find(m => m.role === 'A')?.user_id;
            const debaterB_id = updated.find(m => m.role === 'B')?.user_id;
            const debaterA_name = currentUserNameMap.current[debaterA_id] || 'Debater A';
            const debaterB_name = currentUserNameMap.current[debaterB_id] || 'Debater B';

            fetch('https://argumint.onrender.com/api/judge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                debaterA: aTranscript,
                debaterB: bTranscript,
                topic: currentTopicRef.current,
                debaterA_name,
                debaterB_name
              })
            })
              .then(res => res.json())
              .then(async data => {
                const winnerId = data.winner === 'debaterA' ? debaterA_id : debaterB_id;
                const userTranscript = currentUserRoleRef.current === 'A' ? aTranscript : bTranscript;
                const opponentTranscript = currentUserRoleRef.current === 'A' ? bTranscript : aTranscript;
                const userScore = currentUserRoleRef.current === 'A' ? data.score.debaterA : data.score.debaterB;
                const opponentScore = currentUserRoleRef.current === 'A' ? data.score.debaterB : data.score.debaterA;
                const userFeedback = currentUserRoleRef.current === 'A' ? data.feedback.debaterA : data.feedback.debaterB;
                const opponentFeedback = currentUserRoleRef.current === 'A' ? data.feedback.debaterB : data.feedback.debaterA;

                await supabase.from('debates').insert({
                  user_id: winnerId,
                  topic: currentTopicRef.current,
                  transcript_user: userTranscript,
                  transcript_ai: opponentTranscript,
                  winner: data.winner,
                  score_user: userScore,
                  score_ai: opponentScore,
                  feedback_user: userFeedback,
                  feedback_ai: opponentFeedback
                });

                const resultPayload = {
                  winner: data.winner,
                  score: data.score,
                  feedback: data.feedback,
                  topic: currentTopicRef.current,
                  debaterA_name,
                  debaterB_name
                };

                await supabase.channel(`debate-room-${roomId}`).send({
                  type: 'broadcast',
                  event: 'final_judgement',
                  payload: resultPayload
                });

                navigate('/results', {
                  state: {
                    ...resultPayload,
                    isHumanDebate: true
                  }
                });
              })
              .catch(err => console.error('Judging failed:', err));
          }
          return updated;
        });

        setTypingOpponent(false);
      })
      .on('broadcast', { event: 'final_judgement' }, payload => {
        if (payload.payload.debaterA_name !== currentUserNameMap.current[userId] || currentUserRoleRef.current !== 'A') {
          navigate('/results', {
            state: {
              ...payload.payload,
              isHumanDebate: true
            }
          });
        }
      })
      .on('broadcast', { event: 'typing_status' }, payload => {
        if (payload.payload.user_id !== userId) {
          setTypingOpponent(payload.payload.is_typing);
          if (payload.payload.is_typing) {
            setTimeout(() => setTypingOpponent(false), 3000);
          }
        }
      })
      .subscribe();

    broadcastTypingRef.current = debounce(async isTyping => {
      await supabase.channel(`debate-room-${roomId}`).send({
        type: 'broadcast',
        event: 'typing_status',
        payload: { user_id: userId, is_typing: isTyping }
      });
    }, 500);

    return () => {
      supabase.removeChannel(channel);
      broadcastTypingRef.current?.cancel?.();
    };
  }, [roomId, userId, userRole, navigate, MAX_ROUNDS, loadingRoomData, userNameMap]);

  // Effect for handling real-time transcription via EventSource
  useEffect(() => {
    if (isTranscribing) {
      eventSourceRef.current = new EventSource('https://argumint.onrender.com/api/stream-transcribe/events');
      eventSourceRef.current.onmessage = e => {
        if (e.data) {
          setInput(prev => (prev ? prev + ' ' : '') + e.data);
          broadcastTypingRef.current?.(true);
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

  // Handles sending a message to the debate room
  const sendMessage = async () => {
    if (!input.trim() || !canSend()) return;

    // Stop any playing audio when sending a message
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
    }

    broadcastTypingRef.current?.(false);
    broadcastTypingRef.current?.flush();
    setTypingOpponent(false);
    const profileName = userNameMap[userId] || 'Anonymous';

    const { error } = await supabase.from('debates_live').insert({
      room_id: roomId,
      user_id: userId,
      name: profileName,
      role: userRole,
      message: input.trim()
    });

    if (!error) {
      setInput('');
      if (isTranscribing) {
        setIsTranscribing(false);
        fetch('https://argumint.onrender.com/api/stream-transcribe/stop');
      }
    } else {
      console.error("Send failed:", error);
    }
  };

  // Handles user typing in the input field
  const handleTyping = (e) => {
    setInput(e.target.value);
    broadcastTypingRef.current?.(true);
  };

  // Toggles microphone for speech-to-text transcription
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

  // Handler for setting and confirming debate settings
  const handleSetSettings = async () => {
    const { error } = await supabase
      .from('rooms')
      .update({ max_rounds: MAX_ROUNDS, settings_locked: true })
      .eq('id', roomId);

    if (error) {
      console.error("Error saving debate settings:", error);
    } else {
      setSettingsConfirmed(true);
      setSettingsLocked(true);
    }
  };

  return (
    <motion.div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.h1
        className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Human Debate Room ({messages.length / 2}/{MAX_ROUNDS} rounds)
      </motion.h1>

      {loadingRoomData ? (
        <p className="text-center text-lg text-cyan-300">Loading debate details...</p>
      ) : (
        <>
          <div className="text-center mb-6">
            <strong className="text-cyan-400">Topic:</strong> {topic}
          </div>

          {!settingsLocked && (
            <motion.div
              className="flex flex-col md:flex-row items-center gap-4 mb-6 justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <select value={MAX_ROUNDS} onChange={e => setMAX_ROUNDS(parseInt(e.target.value))} className="bg-slate-800 p-2 rounded border border-white/20">
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} Rounds</option>
                ))}
              </select>

              <motion.button
                className="bg-teal-500 px-5 py-2 rounded-lg font-bold hover:bg-teal-600 text-white"
                onClick={handleSetSettings}
                whileTap={{ scale: 0.96 }}
              >
                Set Settings ✅
              </motion.button>
            </motion.div>
          )}

          <div className="space-y-4 max-w-3xl mx-auto pb-20">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  className={`p-4 rounded-xl max-w-xl ${msg.user_id === userId ? 'bg-cyan-500/20 ml-auto text-right' : 'bg-white/10'}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-sm text-slate-400 mb-1">
                    {userNameMap[msg.user_id] ?? `Debater ${msg.role}`}
                  </p>
                  <p className="text-white text-lg">{msg.message}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {typingOpponent && (
            <motion.div className="text-center text-slate-400 text-sm mb-2 animate-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              ✍️ Opponent is typing...
            </motion.div>
          )}

          {settingsConfirmed && messages.length < totalTurnsNeeded && (
            <div className="fixed bottom-6 left-0 right-0 px-4 max-w-3xl mx-auto flex gap-3">
              <input
                value={input}
                onChange={handleTyping}
                placeholder={canSend() ? "Type your argument..." : "Waiting for opponent..."}
                className="flex-1 p-3 rounded-lg bg-white/10 border border-white/20 text-white"
                disabled={!canSend() || isTranscribing}
              />
              <button
                onClick={handleMicClick}
                title={isTranscribing ? "Stop Speaking" : "Start Speaking"}
                disabled={!canSend() && !isTranscribing}
                className={`px-3 py-2 rounded-lg text-white text-xl ${isTranscribing ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-700'}`}
              >
                {isTranscribing ? '🔴' : '🎙️'}
              </button>
              <button
                onClick={sendMessage}
                className={`px-4 py-2 rounded-lg font-bold ${canSend() ? 'bg-teal-500 hover:bg-teal-600' : 'bg-gray-700 cursor-not-allowed'}`}
                disabled={!canSend()}
              >
                Send
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
