const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const TO = ['zangoulehmusicschool@gmail.com', 'info@zangoulehmusicschool.com'];

const SOURCE_LABELS = {
  contact: 'Contact Page',
  consultation: 'Registration Page — Book a Consultation',
  enrollment: 'Registration Page — Enroll & Pay',
  workshop: 'Events Page — Third Music Ensemble Workshop'
};

function getSupabase() {
  return createClient(process.env.SUPABASE_URL?.trim(), process.env.SUPABASE_SERVICE_KEY?.trim());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const d = req.body;
  const type = d.formType;
  const sourceLabel = SOURCE_LABELS[type];
  let subject, rows;

  if (type === 'contact') {
    subject = `[Contact Page] New message from ${d.name}`;
    rows = [
      ['Name', d.name],
      ['Email', d.email],
      ['Phone', d.phone || '—'],
      ['Subject', d.subject || '—'],
      ['Message', d.message]
    ];
  } else if (type === 'consultation') {
    subject = `[Consultation Request] ${d.firstName} ${d.lastName}`;
    rows = [
      ['Name', `${d.firstName} ${d.lastName}`],
      ['Phone / WhatsApp', d.phone],
      ['Email', d.email || '—'],
      ['Instrument / Program', d.instrument || '—'],
      ['Student Age', d.age || '—'],
      ['Preferred Contact', d.contactMethod || '—'],
      ['Message', d.message || '—']
    ];
  } else if (type === 'enrollment') {
    subject = `[Enrollment] ${d.firstName} ${d.lastName}`;
    rows = [
      ['Name', `${d.firstName} ${d.lastName}`],
      ['Phone / WhatsApp', d.phone],
      ['Email', d.email],
      ['Instrument / Program', d.instrument],
      ['Preferred Instructor', d.instructor || 'School assigned'],
      ['Class Time', d.classTime || '—'],
      ['Lesson Type', d.lessonType || '—'],
      ['Student Age', d.age || '—'],
      ['Package', d.package || '—'],
      ['Payment Method', d.paymentMethod || '—'],
      ['Notes', d.notes || '—']
    ];
  } else if (type === 'workshop') {
    subject = `[Events — Workshop Signup] ${d.fullName}`;
    rows = [
      ['Full Name', d.fullName],
      ['Email', d.email || '—'],
      ['Phone', d.phone],
      ['WhatsApp', d.whatsapp || 'Same as phone'],
      ['Age', d.age || '—'],
      ['Instrument', d.instrument],
      ['Years Playing / Practicing', d.yearsPlaying || '—'],
      ['Last Piece Performed', d.lastPiece || '—'],
      ['Last Method Book Used', d.lastBook || '—'],
      ['Piece Choice', d.pieceChoice || '—']
    ];
  } else {
    return res.status(400).json({ error: 'Unknown form type' });
  }

  // Persist every submission regardless of what happens with the email —
  // this is what powers the admin "Website Messages" view.
  try {
    await getSupabase().from('form_submissions').insert({ form_type: type, data: d });
  } catch (err) {
    console.error('[send-form] failed to save submission:', err.message);
  }

  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  const tableRows = rows.map(([k, v]) =>
    `<tr>
      <td style="padding:8px 14px;font-weight:600;background:#f5f0e0;border:1px solid #d5c9a0;white-space:nowrap">${k}</td>
      <td style="padding:8px 14px;border:1px solid #d5c9a0">${esc(v)}</td>
    </tr>`
  ).join('');

  const html = `
<div style="font-family:sans-serif;max-width:620px;color:#1a1a1a">
  <div style="background:#822331;padding:20px 24px;border-radius:4px 4px 0 0">
    <h2 style="color:#f0d060;margin:0;font-size:18px">Zangouleh Music School</h2>
    <p style="color:rgba(240,208,96,0.8);margin:4px 0 0;font-size:13px">New form submission from the website</p>
  </div>
  <div style="background:#f0d060;color:#822331;padding:10px 14px;font-weight:700;font-size:13px">
    Source: ${esc(sourceLabel)}
  </div>
  <table style="border-collapse:collapse;width:100%">${tableRows}</table>
  <p style="margin:16px 0 0;font-size:11px;color:#aaa">Sent automatically from zangoulehmusicschool.com</p>
</div>`;

  try {
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim().replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });
    await transporter.sendMail({
      from: `"Zangouleh Website" <${gmailUser}>`,
      to: TO.join(', '),
      subject,
      html
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-form]', err.message);
    res.status(500).json({ error: 'Email sending failed' });
  }
};
