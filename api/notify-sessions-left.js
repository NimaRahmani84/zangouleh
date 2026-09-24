const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Mirrors currentPackageFor/computeSessionsLeft in portal.html (~lines
// 396-410) — keep these two in sync if that math ever changes.
function currentPackageFor(payments) {
  const pkgs = (payments || []).filter(p => p.total_sessions);
  if (!pkgs.length) return null;
  return pkgs.sort((a, b) => new Date(b.start_date || b.created_at) - new Date(a.start_date || a.created_at))[0];
}

function computeSessionsLeft(payments, attendance) {
  const pkg = currentPackageFor(payments);
  if (!pkg) return null;
  const startDate = pkg.start_date || pkg.created_at;
  const relevant = (attendance || []).filter(a => a.date >= startDate);
  const presentCount = relevant.filter(a => a.status === 'present').length;
  const unexcusedCount = relevant.filter(a => a.status === 'unexcused').length;
  const freePasses = pkg.package === '12-session' ? 2 : 0;
  const chargeableUnexcused = Math.max(0, unexcusedCount - freePasses);
  return pkg.total_sessions - (presentCount + chargeableUnexcused);
}

module.exports = async (req, res) => {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  try {
    const sb = createClient(process.env.SUPABASE_URL?.trim(), process.env.SUPABASE_SERVICE_KEY?.trim());

    const [{ data: enrollments, error: enrollErr }, { data: payments, error: payErr }, { data: attendance, error: attErr }] = await Promise.all([
      sb.from('enrollments').select('*'),
      sb.from('payments').select('*'),
      sb.from('attendance').select('*')
    ]);
    if (enrollErr) throw enrollErr;
    if (payErr) throw payErr;
    if (attErr) throw attErr;

    const studentIds = [...new Set((enrollments || []).map(e => e.student_id))];
    let profileById = new Map();
    if (studentIds.length) {
      const { data: profiles, error: profErr } = await sb.from('profiles').select('id, email, full_name').in('id', studentIds);
      if (profErr) throw profErr;
      profileById = new Map((profiles || []).map(p => [p.id, p]));
    }

    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim().replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass }
    });

    let sentCount = 0;
    for (const e of (enrollments || [])) {
      const enrollmentPayments = (payments || []).filter(p => p.enrollment_id === e.id);
      const pkg = currentPackageFor(enrollmentPayments);
      if (!pkg) continue;
      if (pkg.reminder_sent) continue;

      const enrollmentAtt = (attendance || []).filter(a => a.enrollment_id === e.id);
      const sessionsLeft = computeSessionsLeft(enrollmentPayments, enrollmentAtt);
      if (sessionsLeft !== 1) continue;

      // Reminder goes to the STUDENT (not the school's own inbox — that's
      // what api/send-form.js's TO constant is for, a different mailbox).
      const student = profileById.get(e.student_id);
      if (!student?.email) continue;

      const html = `
<div style="font-family:sans-serif;max-width:520px;color:#1a1a1a">
  <div style="background:#822331;padding:20px 24px;border-radius:4px 4px 0 0">
    <h2 style="color:#f0d060;margin:0;font-size:18px">Zangouleh Music School</h2>
  </div>
  <div style="padding:20px 24px">
    <p>Hi ${student.full_name || ''},</p>
    <p>You have <b>1 session left</b> in your current ${e.instrument || ''} package${e.teacher_name ? ' with ' + e.teacher_name : ''}.</p>
    <p>Please contact us to register and pay for your next term so your lessons continue without a gap.</p>
    <p style="margin-top:20px">— Zangouleh Music School</p>
  </div>
</div>`;

      try {
        await transporter.sendMail({
          from: `"Zangouleh Music School" <${gmailUser}>`,
          to: student.email,
          subject: `Only 1 session left — ${e.instrument || 'your class'}`,
          html
        });
        await sb.from('payments').update({ reminder_sent: true }).eq('id', pkg.id);
        sentCount++;
      } catch (mailErr) {
        console.error('[notify-sessions-left] failed to email', student.email, mailErr.message);
      }
    }

    return res.status(200).json({ ok: true, sent: sentCount });
  } catch (err) {
    console.error('[notify-sessions-left]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
