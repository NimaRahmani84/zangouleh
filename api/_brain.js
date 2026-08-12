const { createClient } = require('@supabase/supabase-js');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-exp';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

const SYSTEM_PROMPT = `تو دستیار هوشمند آموزشگاه موسیقی زنگوله در تورنتو، کانادا هستی.

اطلاعات پایه:
- تلفن و واتس‌اپ: +1 647 827 6462
- ایمیل: zangoulehmusicschool@gmail.com و info@zangoulehmusicschool.com
- وبسایت: zangoulehmusicschool.com
- تأسیس: ۲۰۱۱ — بیش از یک دهه تجربه آموزش موسیقی

شخصیت: دوستانه، گرم، حرفه‌ای — مثل یک مشاور موسیقی با اشتیاق واقعی.
زبان: فارسی اول. اگر کاربر به انگلیسی بنویسد، انگلیسی جواب بده.
پاسخ‌ها: کوتاه و مفید. از فهرست‌های کوتاه استفاده کن.

قوانین مهم:
۱. اگر کاربر علاقه به ثبت‌نام، کلاس آزمایشی، یا مشاوره نشان داد → ابزار capture_lead را اجرا کن.
۲. اگر دانش‌آموز وضعیت ثبت‌نام یا پرداختش را پرسید → ابزار check_registration_status را اجرا کن.
۳. برای قیمت‌ها و اطلاعاتی که نداری → بگو با +1 647 827 6462 تماس بگیرند یا registration.html را ببینند.
۴. هرگز اطلاعات نادرست اختراع نکن.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'capture_lead',
      description: 'وقتی کاربر علاقه به ثبت‌نام، کلاس آزمایشی، یا مشاوره نشان داد، این ابزار را اجرا کن تا اطلاعات تماس ذخیره شود. ابتدا نام را بپرس اگر نداری.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'نام کامل' },
          phone: { type: 'string', description: 'شماره تلفن' },
          email: { type: 'string', description: 'ایمیل' },
          instrument: { type: 'string', description: 'ساز یا برنامه مورد علاقه' },
          notes: { type: 'string', description: 'جزئیات اضافه' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_registration_status',
      description: 'وضعیت ثبت‌نام، حضور، و پرداخت یک دانش‌آموز را بررسی کن',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'ایمیل دانش‌آموز' },
          phone: { type: 'string', description: 'شماره تلفن دانش‌آموز' }
        }
      }
    }
  }
];

async function callOpenRouter(messages) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://zangoulehmusicschool.com',
      'X-Title': 'Zangouleh Music School'
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      max_tokens: 1024,
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }
  return res.json();
}

async function searchKnowledge(query) {
  try {
    const sb = getSupabase();
    const terms = query.trim().split(/\s+/).slice(0, 6).join(' | ');
    const { data } = await sb
      .from('knowledge_base')
      .select('title, content')
      .textSearch('content_tsv', terms, { config: 'simple' })
      .limit(4);
    return data || [];
  } catch {
    return [];
  }
}

async function captureLead(input, source) {
  try {
    const sb = getSupabase();
    await sb.from('leads').insert({ ...input, source });
    return 'اطلاعات ذخیره شد. تیم زنگوله به زودی با شما تماس خواهد گرفت.';
  } catch {
    return 'خطا در ذخیره. لطفاً مستقیماً با +1 647 827 6462 تماس بگیرید.';
  }
}

async function checkRegistrationStatus({ email, phone }) {
  try {
    const sb = getSupabase();
    let q = sb.from('profiles').select('full_name, instrument, teacher_name');
    if (email) q = q.eq('email', email);
    else if (phone) q = q.ilike('phone', `%${String(phone).replace(/\D/g, '')}%`);
    const { data: profile } = await q.maybeSingle();
    if (!profile) return 'دانش‌آموزی با این مشخصات پیدا نشد. با مدرسه تماس بگیرید.';

    const { data: payment } = await sb
      .from('payments')
      .select('status, due_date, package, amount')
      .eq('student_email', email || '')
      .order('due_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    let result = `نام: ${profile.full_name}\nساز: ${profile.instrument}\nاستاد: ${profile.teacher_name}`;
    if (payment) {
      const statusFa = payment.status === 'paid' ? '✅ پرداخت‌شده' : '⏳ در انتظار پرداخت';
      result += `\nبسته: ${payment.package}\nوضعیت: ${statusFa}\nتاریخ سررسید: ${payment.due_date}`;
    }
    return result;
  } catch {
    return 'خطا در بررسی وضعیت. با مدرسه تماس بگیرید.';
  }
}

async function processMessage(message, history = [], source = 'web') {
  const chunks = await searchKnowledge(message);
  const context = chunks.map(k => `**${k.title}**\n${k.content}`).join('\n\n');
  const systemContent = SYSTEM_PROMPT + (context ? `\n\n## اطلاعات مرتبط:\n${context}` : '');

  // Working message array (may include tool_calls / tool results mid-loop)
  const msgs = [
    { role: 'system', content: systemContent },
    ...history.slice(-18),
    { role: 'user', content: message }
  ];

  let response = await callOpenRouter(msgs);
  let choice = response.choices[0];

  // Tool-use loop
  while (choice.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length) {
    msgs.push(choice.message); // assistant message with tool_calls

    for (const tc of choice.message.tool_calls) {
      let result;
      try {
        const args = JSON.parse(tc.function.arguments || '{}');
        if (tc.function.name === 'capture_lead') result = await captureLead(args, source);
        else if (tc.function.name === 'check_registration_status') result = await checkRegistrationStatus(args);
        else result = 'ابزار ناشناخته';
      } catch {
        result = 'خطا در اجرای ابزار';
      }
      msgs.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }

    response = await callOpenRouter(msgs);
    choice = response.choices[0];
  }

  const reply = choice.message?.content || 'متأسفم، مشکلی پیش آمد.';

  // Return clean history (user/assistant text only) — no tool_calls objects
  const updatedMessages = [
    ...history.slice(-18),
    { role: 'user', content: message },
    { role: 'assistant', content: reply }
  ];

  return { reply, updatedMessages };
}

module.exports = { processMessage, getSupabase };
