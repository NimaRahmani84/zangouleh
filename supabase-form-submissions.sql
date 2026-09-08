-- ══════════════════════════════════════════════════
-- ZANGOULEH — Store all website form submissions
-- این فایل را در Supabase SQL Editor اجرا کنید
-- ══════════════════════════════════════════════════
-- تا الان فرم‌های سایت (Contact, Registration Consultation,
-- Registration Enroll, Events Workshop) فقط ایمیل می‌فرستادند و هیچ‌جا
-- ذخیره نمی‌شدند. این جدول همه‌شان را نگه می‌دارد تا در پنل ادمین
-- قابل مشاهده باشند.

CREATE TABLE IF NOT EXISTS form_submissions (
  id SERIAL PRIMARY KEY,
  form_type TEXT NOT NULL CHECK (form_type IN ('contact','consultation','enrollment','workshop')),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
-- فقط با service key قابل دسترسی (بک‌اند سایت insert می‌کند، پنل ادمین با service key می‌خواند)

SELECT 'form_submissions table created.' AS status;
