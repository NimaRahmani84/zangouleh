const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  try {
    const sb = createClient(process.env.SUPABASE_URL?.trim(), process.env.SUPABASE_SERVICE_KEY?.trim());
    const { error } = await sb.from('leads').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return res.status(200).json({ ok: true, pinged_at: new Date().toISOString() });
  } catch (err) {
    console.error('[keepalive]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
