const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    name: 'capture_lead',
    description: 'وقتی کاربر علاقه به ثبت‌نام، کلاس آزمایشی، یا مشاوره نشان داد، این ابزار را اجرا کن تا اطلاعات تماس ذخیره شود. ابتدا نام را بپرس اگر نداری.',
    input_schema: {
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
  },
  {
    name: 'check_registration_status',
    description: 'وضعیت ثبت‌نام، حضور، و پرداخت یک دانش‌آموز را بررسی کن',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'ایمیل دانش‌آموز' },
        phone: { type: 'string', description: 'شماره تلفن دانش‌آموز' }
      }
    }
  }
];

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
  const system = SYSTEM_PROMPT + (context ? `\n\n## اطلاعات مرتبط:\n${context}` : '');

  const msgs = [...history.slice(-18), { role: 'user', content: message }];

  let response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system,
    messages: msgs,
    tools: TOOLS
  });

  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter(b => b.type === 'tool_use');
    const results = [];
    for (const tb of toolBlocks) {
      let r;
      if (tb.name === 'capture_lead') r = await captureLead(tb.input, source);
      else if (tb.name === 'check_registration_status') r = await checkRegistrationStatus(tb.input);
      else r = 'ابزار ناشناخته';
      results.push({ type: 'tool_result', tool_use_id: tb.id, content: r });
    }
    msgs.push({ role: 'assistant', content: response.content });
    msgs.push({ role: 'user', content: results });
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages: msgs,
      tools: TOOLS
    });
  }

  const reply = response.content.find(b => b.type === 'text')?.text || 'متأسفم، مشکلی پیش آمد.';
  const updatedMessages = [...msgs, { role: 'assistant', content: reply }];
  return { reply, updatedMessages };
}

module.exports = { processMessage, getSupabase };
