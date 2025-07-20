import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.post('/', async (req, res) => {
  const {
    user_id,
    topic,
    transcript_user,
    transcript_ai,
    winner,
    score_user,
    score_ai,
    feedback_user,
    feedback_ai
  } = req.body;

  if (!user_id || !topic || !transcript_user || !transcript_ai) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    console.log(user_id,
    topic,
    transcript_user,
    transcript_ai,
    winner,
    score_user,
    score_ai,
    feedback_user,
    feedback_ai);
        const { error: insertError } = await supabase.from('debates').insert([
      {
        user_id,
        topic,
        transcript_user,
        transcript_ai,
        winner,
        score_user,
        score_ai,
        feedback_user,
        feedback_ai
      }
    ]);

    if (insertError) throw insertError;

    // Update user profile if user won (debaterA = user)
    if (winner === 'debaterA') {
      const { error: rpcError } = await supabase.rpc('increment_debates_won', {
        uid: user_id
      });
      if (rpcError) throw rpcError;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Save failed:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
