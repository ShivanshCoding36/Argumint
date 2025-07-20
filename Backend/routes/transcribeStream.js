// transcribeStream.js
import { Readable } from 'stream';
import { AssemblyAI } from 'assemblyai';
import recorder from 'node-record-lpcm16';
import fs from 'fs';
import express from 'express';

const router = express.Router();
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_KEY });
const transcriptStream = fs.createWriteStream('transcript.txt', { flags: 'a' });

// SSE subscribers
const subscribers = new Set();
function broadcast(text) {
  subscribers.forEach(res => res.write(`data: ${text}\n\n`));
}

// Start streaming
router.get('/start', async (req, res) => {
  const transcriber = client.streaming.transcriber({ sampleRate: 16000, formatTurns: true });
  let last = '';

  transcriber.on('turn', turn => {
    const t = typeof turn.transcript === 'string' ? turn.transcript : turn.transcript?.text;
    if (turn.end_of_turn && turn.turn_is_formatted && t && t !== last) {
      transcriptStream.write(t + '\n');
      last = t;
      broadcast(t);
    }
  });

  // Wait for WebSocket to be ready before piping audio
  transcriber.on('ready', () => {
    const rec = recorder.record({ channels: 1, sampleRate: 16000, audioType: 'wav' });
    Readable.toWeb(rec.stream()).pipeTo(transcriber.stream());
    router.locals = { transcriber, rec };
    console.log('Transcriber ready, audio streaming started');
  });

  await transcriber.connect(); // Connect WebSocket
  res.json({ status: 'started' });
});

// Stop streaming
router.get('/stop', async (req, res) => {
  try {
    router.locals?.rec?.stop();
    await router.locals?.transcriber?.close();
    transcriptStream.end();
    res.json({ status: 'stopped' });
  } catch (err) {
    console.error('Error stopping stream:', err);
    res.status(500).json({ error: 'Failed to stop transcription' });
  }
});

// SSE endpoint
router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');
  subscribers.add(res);
  req.on('close', () => subscribers.delete(res));
});

export default router;
