const { processMessage, getSupabase } = require('./_brain');

const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function tgPost(method, body) {
  await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function getSession(id) {
  try {
    const { data } = await getSupabase()
      .from('chat_sessions')
      .select('messages')
      .eq('id', id)
      .maybeSingle();
    return data?.messages || [];
  } catch { return []; }
}

async function saveSession(id, messages) {
  try {
    await getSupabase().from('chat_sessions').upsert({
      id,
      messages: messages.slice(-20),
      updated_at: new Date().toISOString()
    });
  } catch { /* silent */ }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const update = req.body;
  const msg = update?.message || update?.edited_message;
  if (!msg?.text) return res.status(200).json({ ok: true });

  const chatId = String(msg.chat.id);
  const text = msg.text;

  // Typing indicator (fire and forget)
  tgPost('sendChatAction', { chat_id: chatId, action: 'typing' });

  const history = await getSession(chatId);
  const { reply, updatedMessages } = await processMessage(text, history, 'telegram');
  await saveSession(chatId, updatedMessages);

  await tgPost('sendMessage', {
    chat_id: chatId,
    text: reply,
    parse_mode: 'Markdown'
  });

  res.status(200).json({ ok: true });
};
