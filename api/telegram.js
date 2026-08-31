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

  let reply = 'متأسفم، مشکلی پیش آمد. لطفاً دوباره تلاش کنید.';
  try {
    const result = await processMessage(text, history, 'telegram');
    reply = result.reply;
    await saveSession(chatId, result.updatedMessages);
  } catch (err) {
    console.error('[telegram] processMessage error:', err.message, err.stack);
  }

  await tgPost('sendMessage', {
    chat_id: chatId,
    text: reply,
    parse_mode: 'Markdown'
  });

  res.status(200).json({ ok: true });
};
