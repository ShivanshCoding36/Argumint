import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import judgeRouter from './routes/judge.js';
import saveRouter from './routes/saveDebate.js';
import generateTopicRouter from './routes/generateTopic.js';
import aiResponseRouter from './routes/aiResponse.js';

dotenv.config();

const app = express();

// ✅ CORS config for Vercel frontend
app.use(cors({
  origin: 'https://argumint.vercel.app',
  credentials: true
}));

app.use(express.json());

app.use('/api/ai-response', aiResponseRouter);
app.use('/api/save', saveRouter);
app.use('/api/judge', judgeRouter);
app.use('/api/generate-topic', generateTopicRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🧠 Judging API running on port ${PORT}`));
