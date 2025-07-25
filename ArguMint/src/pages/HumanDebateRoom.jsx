import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
import useAudioRecorder from '../components/useAudioRecorder'; // Ensure this path is correct
import encodeWAV from 'audiobuffer-to-wav';
import axios from 'axios';

export default function HumanDebateRoom() {
    const { roomId } = useParams();
    const navigate = useNavigate();

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(''); // 'A' or 'B'
    const [userNameMap, setUserNameMap] = useState({});
    const [typingOpponent, setTypingOpponent] = useState(false);
    const [topic, setTopic] = useState('');
    const [MAX_ROUNDS, setMAX_ROUNDS] = useState(3);
    const [settingsConfirmed, setSettingsConfirmed] = useState(false);
    const [settingsLocked, setSettingsLocked] = useState(false);
    const [loadingRoomData, setLoadingRoomData] = useState(true);

    // Speech-to-Text (STT) state and hook
    const { isRecording, audioBlob, error: micError, startRecording, stopRecording } = useAudioRecorder();
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [sttError, setSttError] = useState(null);

    // Text-to-Speech (TTS) state
    const currentAudioRef = useRef(null);
    const [playingMessageId, setPlayingMessageId] = useState(null);
    const [isDecodingAudio, setIsDecodingAudio] = useState(false);
    const [pausedTime, setPausedTime] = useState(0);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);

    const messagesEndRef = useRef(null);
    const broadcastTypingRef = useRef(null);
    const currentUserNameMap = useRef({});
    const currentTopicRef = useRef('');
    const currentUserRoleRef = useRef('');
    const chunkAudioRefs = useRef({});
    const currentChunkIndexRef = useRef(0);

    const totalTurnsNeeded = MAX_ROUNDS * 2;
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

    const playMessageAudio = async (text, messageId, resume = false) => {
        setIsDecodingAudio(true);
        setPlayingMessageId(messageId);

        if (!resume) {
            chunkAudioRefs.current[messageId] = [];
            currentChunkIndexRef.current = 0;
        }

        if (chunkAudioRefs.current[messageId].length === 0) {
            const chunks = splitText(text, 300);

            for (const chunk of chunks) {
                const payload = {
                    text: chunk,
                    target_language_code: "en-IN",
                    speaker: "vidya",
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

            audio.onloadedmetadata = () => {
                setAudioDuration(audio.duration);
            };

            audio.ontimeupdate = () => {
                setAudioProgress(audio.currentTime);
            };

            audio.onended = () => {
                currentChunkIndexRef.current = index + 1;
                playChunks(index + 1);
            };

            audio.onerror = () => {
                console.error("Audio playback error in chunk", index);
                playChunks(index + 1); // skip
            };

            if (pausedTime > 0 && resume) {
                audio.currentTime = pausedTime;
                setPausedTime(0);
            }
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
            playMessageAudio(text, messageId, true);
        } else {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
            }
            setPausedTime(0);
            playMessageAudio(text, messageId, false);
        }
    };

    const canSend = () => {
        if (!userId || !userRole || messages.length >= totalTurnsNeeded || !settingsConfirmed) return false;
        if (messages.length === 0) {
            return userRole === 'A';
        } else {
            const lastMsg = messages[messages.length - 1];
            return lastMsg.role !== userRole;
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const init = async () => {
            setLoadingRoomData(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoadingRoomData(false);
                return navigate('/login');
            }
            setUserId(user.id);

            let topicFetched = '';
            let maxRoundsFetched = null;
            let dbSettingsLocked = false;

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
                const savedTopic = sessionStorage.getItem(`currentTopic`);
                if (savedTopic) {
                    topicFetched = savedTopic;
                    sessionStorage.setItem('currentTopic', '');
                    try {
                        const { error: insertError } = await supabase
                            .from('rooms')
                            .insert({ id: roomId, topic: topicFetched })
                            .select()
                            .maybeSingle();

                        if (insertError) {
                            console.error("Room creation from session storage failed:", insertError);
                            topicFetched = 'Failed to persist topic. Generating new.';
                            sessionStorage.removeItem(`currentTopic`);
                            await generateAndInsertTopic(user.id);
                        }
                    } catch (err) {
                        console.error('Error persisting topic from session:', err);
                        topicFetched = 'Failed to persist topic. Generating new.';
                        sessionStorage.removeItem(`currentTopic`);
                        await generateAndInsertTopic(user.id);
                    }
                } else {
                    topicFetched = await generateAndInsertTopic(user.id);
                }
            }

            setTopic(topicFetched);
            currentTopicRef.current = topicFetched;

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
                    sessionStorage.setItem(`currentTopic`, generatedTopic);
                    return generatedTopic;
                } catch (err) {
                    console.error('Failed to generate topic:', err);
                    return 'Failed to generate topic.';
                }
            }

            const { data: initialMessages } = await supabase
                .from('debates_live')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at');

            setMessages(initialMessages || []);

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

                if (msg.user_id !== userId) {
                    playMessageAudio(msg.message, msg.id);
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
                    setSttError(`Failed to convert audio to WAV: ${conversionError.message}.`);
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


    const sendMessage = async () => {
        if (!input.trim() || !canSend()) return;

        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
            setPlayingMessageId(null);
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
            if (isRecording) {
                stopRecording();
            }
        } else {
            console.error("Send failed:", error);
        }
    };

    const handleTyping = (e) => {
        setInput(e.target.value);
        broadcastTypingRef.current?.(true);
    };

    const handleMicClick = async () => {
        if (isDecodingAudio || !canSend()) return;

        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
            setInput('');
            setSttError(null);
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current = null;
                setPlayingMessageId(null);
                setPausedTime(0);
            }
        }
    };

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

    const isInputDisabled = !canSend() || isTranscribing || isRecording || isDecodingAudio;

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
                Human Debate Room ({Math.floor(messages.length / 2)}/{MAX_ROUNDS} rounds)
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

                    <div className="space-y-4 max-w-3xl mx-auto pb-28">
                        <AnimatePresence>
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={msg.id || i}
                                    className={`p-4 rounded-xl max-w-xl ${msg.user_id === userId ? 'bg-cyan-500/20 ml-auto text-right' : 'bg-white/10'}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-sm text-slate-400">
                                            {userNameMap[msg.user_id] ?? `Debater ${msg.role}`}
                                        </p>
                                        {msg.user_id !== userId && (
                                            <button
                                                className="text-xl cursor-pointer text-teal-400 hover:text-teal-300 transition-colors"
                                                title={playingMessageId === msg.id ? "Pause Audio" : "Play Audio"}
                                                onClick={() => togglePlayPause(msg.message, msg.id)}
                                                disabled={isDecodingAudio || (playingMessageId && playingMessageId !== msg.id)}
                                            >
                                                {playingMessageId === msg.id && !currentAudioRef.current?.paused ? '⏸️' : '▶️'}
                                            </button>
                                        )}
                                    </div>

                                    <p className="text-white text-lg">{msg.message}</p>
                                    {playingMessageId === msg.id && currentAudioRef.current && (
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
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>

                    {typingOpponent && (
                        <motion.div className="fixed bottom-24 left-0 right-0 text-center text-slate-400 text-sm animate-pulse"
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
                                placeholder={
                                    isRecording ? "Listening..." :
                                        isTranscribing ? "Transcribing..." :
                                            isDecodingAudio ? "Opponent audio playing..." :
                                                canSend() ? "Type your argument..." : "Waiting for opponent..."
                                }
                                className="flex-1 p-3 rounded-lg bg-white/10 border border-white/20 text-white"
                                disabled={isInputDisabled}
                                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                            />
                            <button
                                onClick={handleMicClick}
                                title={isRecording ? "Stop Speaking" : "Start Speaking"}
                                disabled={isInputDisabled && !isRecording}
                                className={`px-3 py-2 rounded-lg text-white text-xl ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-700'} ${isInputDisabled && !isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isRecording ? '🔴' : '🎙️'}
                            </button>
                            <button
                                onClick={sendMessage}
                                className={`px-4 py-2 rounded-lg font-bold ${canSend() && !isRecording && !isTranscribing ? 'bg-teal-500 hover:bg-teal-600' : 'bg-gray-700 cursor-not-allowed'}`}
                                disabled={isInputDisabled || !input.trim()}
                            >
                                Send
                            </button>
                        </div>
                    )}
                    {(micError || sttError) && (
                        <p className="fixed bottom-24 left-0 right-0 text-red-400 text-center mt-4">Error: {micError || sttError}</p>
                    )}
                </>
            )}
        </motion.div>
    );
}
