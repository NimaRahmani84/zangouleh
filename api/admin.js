const { createClient } = require('@supabase/supabase-js');

function getServiceClient() {
  return createClient(process.env.SUPABASE_URL?.trim(), process.env.SUPABASE_SERVICE_KEY?.trim());
}

async function requireAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const sb = getServiceClient();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return null;
  return user;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: 'دسترسی غیرمجاز' });

  const sb = getServiceClient();
  const { action, payload = {} } = req.body || {};

  try {
    switch (action) {
      case 'stats': {
        const [{ count: leads }, { count: kb }, { count: sessions }] = await Promise.all([
          sb.from('leads').select('*', { count: 'exact', head: true }),
          sb.from('knowledge_base').select('*', { count: 'exact', head: true }),
          sb.from('chat_sessions').select('*', { count: 'exact', head: true })
        ]);
        return res.json({ leads: leads || 0, kb: kb || 0, sessions: sessions || 0 });
      }

      case 'list_leads': {
        const { data, error } = await sb.from('leads').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ data });
      }

      case 'delete_lead': {
        const { error } = await sb.from('leads').delete().eq('id', payload.id);
        if (error) throw error;
        return res.json({ ok: true });
      }

      case 'list_kb': {
        const { data, error } = await sb.from('knowledge_base').select('id, title, content, created_at').order('id', { ascending: true });
        if (error) throw error;
        return res.json({ data });
      }

      case 'create_kb': {
        if (!payload.title || !payload.content) return res.status(400).json({ error: 'عنوان و محتوا الزامی است' });
        const { error } = await sb.from('knowledge_base').insert({ title: payload.title, content: payload.content });
        if (error) throw error;
        return res.json({ ok: true });
      }

      case 'update_kb': {
        const { error } = await sb.from('knowledge_base')
          .update({ title: payload.title, content: payload.content })
          .eq('id', payload.id);
        if (error) throw error;
        return res.json({ ok: true });
      }

      case 'delete_kb': {
        const { error } = await sb.from('knowledge_base').delete().eq('id', payload.id);
        if (error) throw error;
        return res.json({ ok: true });
      }

      case 'list_sessions': {
        const { data, error } = await sb.from('chat_sessions')
          .select('id, messages, updated_at')
          .order('updated_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        const summarized = (data || []).map(s => {
          const msgs = Array.isArray(s.messages) ? s.messages : [];
          const lastText = [...msgs].reverse().find(m => typeof m.content === 'string')?.content || '';
          return { id: s.id, updated_at: s.updated_at, message_count: msgs.length, last_message: lastText };
        });
        return res.json({ data: summarized });
      }

      case 'get_session': {
        const { data, error } = await sb.from('chat_sessions')
          .select('id, messages, updated_at')
          .eq('id', payload.id)
          .maybeSingle();
        if (error) throw error;
        return res.json({ data });
      }

      default:
        return res.status(400).json({ error: 'عملیات ناشناخته' });
    }
  } catch (err) {
    console.error('[admin]', action, err.message);
    return res.status(500).json({ error: err.message });
  }
};
