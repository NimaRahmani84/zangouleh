const nodemailer = require('nodemailer');

const TO = ['zangoulehmusicschool@gmail.com', 'info@zangoulehmusicschool.com'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const d = req.body;
  const type = d.formType;
  let subject, rows;

  if (type === 'contact') {
    subject = `[Website] Contact from ${d.name}`;
    rows = [
      ['Name', d.name],
      ['Email', d.email],
      ['Phone', d.phone || '—'],
      ['Subject', d.subject || '—'],
      ['Message', d.message]
    ];
  } else if (type === 'consultation') {
    subject = `[Website] Consultation Request — ${d.firstName} ${d.lastName}`;
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
    subject = `[Website] Enrollment — ${d.firstName} ${d.lastName}`;
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
  } else {
    return res.status(400).json({ error: 'Unknown form type' });
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
  <table style="border-collapse:collapse;width:100%">${tableRows}</table>
  <p style="margin:16px 0 0;font-size:11px;color:#aaa">Sent automatically from zangoulehmusicschool.com</p>
</div>`;

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    await transporter.sendMail({
      from: `"Zangouleh Website" <${process.env.GMAIL_USER}>`,
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
