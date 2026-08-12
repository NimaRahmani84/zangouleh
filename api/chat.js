const { processMessage } = require('./_brain');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { message, history = [], source = 'web' } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  try {
    const { reply, updatedMessages } = await processMessage(message, history, source);
    res.status(200).json({ reply, history: updatedMessages });
  } catch (err) {
    console.error('[chat]', err.message);
    res.status(500).json({ error: 'متأسفم، خطایی رخ داد. لطفاً دوباره تلاش کنید.' });
  }
};
