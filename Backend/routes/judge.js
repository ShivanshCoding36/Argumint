import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();
const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const JUDGING_MODEL = 'gemini-2.0-flash'; // Using the latest Flash model

router.post('/', async (req, res) => {
    const { debaterA, debaterB, topic, nameA, nameB } = req.body;

    if (!debaterA || !debaterB) {
        return res.status(400).json({ error: 'Missing transcripts.' });
    }

    const model = genAI.getGenerativeModel({ model: JUDGING_MODEL });

    const prompt = `
You are an impartial AI debate judge. Score the two debaters on logic, rebuttal, and clarity. Then provide brief feedback for both. Return the result strictly in JSON format.

Topic:
${topic}

Debater A (${nameA}):
${debaterA}

Debater B (${nameB}):
${debaterB}

Please respond in the following JSON format:
{
  "winner": "debaterA" or "debaterB",
  "score": { "debaterA": 0-100, "debaterB": 0-100 },
  "feedback": {
    "debaterA": "brief feedback",
    "debaterB": "brief feedback"
  }
}
`;


    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7,
                responseMimeType: "application/json", // Explicitly request JSON output
            },
        });

        const response = result.response;
        let text = response.text().trim();
        console.log(`Raw Judge Response: ${text}`);

        // The responseMimeType should make this less necessary, but keep as a fallback for robustness
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');

        const parsed = JSON.parse(text);
        res.json(parsed);
    } catch (err) {
        console.error('Error during judging:', err);
        res.status(500).json({ error: 'Judging failed', details: err.message || 'Unknown error' });
    }
});

export default router;