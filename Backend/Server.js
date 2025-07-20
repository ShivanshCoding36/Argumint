import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import judgeRouter from './routes/judge.js';
import transcribeRouter from './routes/transcribe.js';
import saveRouter from './routes/saveDebate.js';
import generateTopicRouter from './routes/generateTopic.js';
import aiResponseRouter from './routes/aiResponse.js';
import getCredentials from './routes/assemblyai.js'
import transcribeStreamRouter from './routes/transcribeStream.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/ai-response', aiResponseRouter);
app.use('/api/save', saveRouter);
app.use('/api/judge', judgeRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/generate-topic', generateTopicRouter);
app.use('/api/get-credentials', getCredentials);

app.use('/api/stream-transcribe', transcribeStreamRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🧠 Judging API running on port ${PORT}`));
