import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', upload.single('audio'), async (req, res) => {
  try {
    const transcript = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: fs.createReadStream(req.file.path),
      response_format: 'text'
    });
    fs.unlinkSync(req.file.path); // cleanup temp file
    res.json({ transcript });
  } catch (err) {
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

export default router;
