import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  const apiKey = process.env.ASSEMBLY_API;
  if (!apiKey) {
    console.error("❌ Missing ASSEMBLY_API in .env");
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  console.log("🔐 Using API Key (partially shown):", apiKey.slice(0, 6) + '...');

  try {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        Authorization: apiKey
      }
    });

    const text = await response.text(); // Use `.text()` to capture raw error messages too
    console.log("📡 AssemblyAI Response Status:", response.status);
    console.log("📦 AssemblyAI Response Body:", text);

    if (!response.ok) {
      return res.status(response.status).json({ error: `AssemblyAI error: ${text}` });
    }

    const data = JSON.parse(text);
    res.json(data);

  } catch (error) {
    console.log(error.message);
    console.error('❌ Exception while fetching AssemblyAI token:', error);
    res.status(500).json({ error: 'Failed to get token' });
  }
});

export default router;
