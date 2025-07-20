import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient'; // Adjust this path if your supabaseClient.js is elsewhere

// This component is for testing purposes only
export default function RealtimeTestComponent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState('test-room-123'); // Use a consistent test room ID
  const [realtimeStatus, setRealtimeStatus] = useState('Not connected');
  const [receivedBroadcasts, setReceivedBroadcasts] = useState([]);

  const channelRef = useRef(null); // To store the channel instance

  // 1. Get current user ID on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        console.log('TESTER: Fetched current user ID:', user.id);
      } else {
        console.warn('TESTER: No authenticated user found. Please log in for full test functionality.');
        setCurrentUserId('anonymous-test-user'); // Fallback for testing inserts without auth
      }
    };
    fetchUser();
  }, []);

  // 2. Setup Realtime Subscription
  useEffect(() => {
    if (!currentUserId || !currentRoomId) {
      console.log('TESTER: Waiting for user ID and room ID before subscribing...');
      return;
    }

    const channelName = `debate-room-${currentRoomId}`;
    console.log(`TESTER: Attempting to subscribe to channel: ${channelName}`);
    setRealtimeStatus('Connecting...');

    const channel = supabase
      .channel(channelName)
      // Listen for database changes (INSERTs)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'debates_live', filter: `room_id=eq.${currentRoomId}` },
        (payload) => {
          console.log('TESTER: postgres_changes - INSERT received!', payload.new);
          setMessages((prev) => [...prev, payload.new]);
          setRealtimeStatus(`Received INSERT: ${payload.new.message}`);
        }
      )
      // Listen for broadcast messages (like typing indicators)
      .on('broadcast', { event: 'typing_status' }, (payload) => {
        console.log('TESTER: Broadcast - typing_status received!', payload.payload);
        setReceivedBroadcasts((prev) => [...prev, payload.payload]);
        setRealtimeStatus(`Received Broadcast: Typing status from ${payload.payload.user_id}`);
      })
      .subscribe((status) => {
        console.log(`TESTER: Channel [${channelName}] Subscription Status:`, status);
        setRealtimeStatus(`Subscription Status: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log(`TESTER: Channel [${channelName}] is fully SUBSCRIBED!`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`TESTER: Channel [${channelName}] encountered an ERROR! Check Realtime/RLS.`);
        }
      });

    channelRef.current = channel; // Store channel instance

    // Cleanup function
    return () => {
      if (channelRef.current) {
        console.log(`TESTER: Unsubscribing from channel: ${channelName}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUserId, currentRoomId]); // Re-subscribe if these change

  // Function to send a message (insert into database)
  const sendMessage = async () => {
    if (!input.trim() || !currentUserId || !currentRoomId) {
      console.warn('TESTER: Cannot send message: Input or user/room ID missing.');
      return;
    }

    setRealtimeStatus('Sending message...');
    try {
      const { error } = await supabase.from('debates_live').insert({
        room_id: currentRoomId,
        user_id: currentUserId,
        role: 'tester_role', // A dummy role for testing
        message: input.trim(),
      });

      if (error) {
        console.error('TESTER: Error inserting message:', error);
        setRealtimeStatus(`Error sending: ${error.message}`);
      } else {
        setInput('');
        setRealtimeStatus('Message sent to DB, check Realtime log!');
        console.log('TESTER: Message successfully inserted into database.');
      }
    } catch (e) {
      console.error('TESTER: Caught exception sending message:', e);
      setRealtimeStatus(`Exception sending: ${e.message}`);
    }
  };

  // Function to send a typing broadcast
  const sendTypingBroadcast = async (isTyping) => {
    if (!channelRef.current || !currentUserId) {
      console.warn('TESTER: Channel not ready or user ID missing for broadcast.');
      return;
    }
    try {
      const { error } = await channelRef.current.send({
        type: 'broadcast',
        event: 'typing_status',
        payload: { user_id: currentUserId, is_typing: isTyping, timestamp: new Date().toISOString() },
      });
      if (error) {
        console.error('TESTER: Error sending broadcast:', error);
      } else {
        console.log(`TESTER: Broadcasted typing status: ${isTyping}`);
      }
    } catch (e) {
      console.error('TESTER: Caught exception sending broadcast:', e);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#222', color: '#eee' }}>
      <h2>Realtime Test Component</h2>
      <p><strong>Current User ID:</strong> {currentUserId || 'Loading...'}</p>
      <p><strong>Test Room ID:</strong> {currentRoomId}</p>
      <p><strong>Realtime Status:</strong> <span style={{ color: realtimeStatus.includes('Error') ? 'red' : realtimeStatus.includes('SUBSCRIBED') ? 'lightgreen' : 'orange' }}>{realtimeStatus}</span></p>

      <hr style={{ margin: '20px 0' }} />

      <h3>Send Message (DB Insert)</h3>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
        style={{ width: 'calc(100% - 100px)', padding: '8px', marginRight: '10px', backgroundColor: '#333', color: '#eee', border: '1px solid #555' }}
      />
      <button onClick={sendMessage} style={{ padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>
        Send DB Insert
      </button>

      <div style={{ marginTop: '10px' }}>
        <button onClick={() => sendTypingBroadcast(true)} style={{ padding: '8px 15px', marginRight: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>
          Send Typing (True)
        </button>
        <button onClick={() => sendTypingBroadcast(false)} style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', cursor: 'pointer' }}>
          Send Typing (False)
        </button>
      </div>

      <hr style={{ margin: '20px 0' }} />

      <h3>Received DB Messages (postgres_changes)</h3>
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {messages.length === 0 && <li style={{ color: '#aaa' }}>No messages received yet.</li>}
        {messages.map((msg, index) => (
          <li key={index} style={{ borderBottom: '1px dashed #444', padding: '5px 0' }}>
            <strong style={{ color: '#ffc107' }}>[{new Date(msg.created_at).toLocaleTimeString()}]</strong>
            <span style={{ color: '#17a2b8' }}> {msg.user_id?.substring(0, 8)}...({msg.role}):</span> {msg.message}
          </li>
        ))}
      </ul>

      <hr style={{ margin: '20px 0' }} />

      <h3>Received Broadcasts</h3>
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {receivedBroadcasts.length === 0 && <li style={{ color: '#aaa' }}>No broadcasts received yet.</li>}
        {receivedBroadcasts.map((b, index) => (
          <li key={index} style={{ borderBottom: '1px dashed #444', padding: '5px 0' }}>
            <strong style={{ color: '#6f42c1' }}>[{new Date(b.timestamp).toLocaleTimeString()}]</strong>
            <span style={{ color: '#fd7e14' }}> User {b.user_id?.substring(0, 8)}... is typing:</span> {b.is_typing ? 'TRUE' : 'FALSE'}
          </li>
        ))}
      </ul>
    </div>
  );
}