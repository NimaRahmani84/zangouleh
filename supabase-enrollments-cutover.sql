-- ══════════════════════════════════════════════════
-- ZANGOULEH — Enrollments Cutover (RLS)
-- فقط بعد از دیپلوی و تست کد جدید portal.html اجرا کنید
-- (نه بلافاصله بعد از supabase-enrollments.sql)
-- ══════════════════════════════════════════════════
-- تا وقتی این فایل اجرا نشده، policy های قدیمی روی profiles.teacher_id
-- کار می‌کنند و همه‌چیز برای هنرجوهای فعلی (یک‌استاده) دقیقاً مثل قبل
-- می‌ماند. این فایل قفل «هر هنرجو فقط یک استاد» را واقعاً باز می‌کند.

-- ۱. دیگر claim کردن یک UPDATE روی profiles نیست، بلکه یک INSERT روی
--    enrollments است (طبق supabase-enrollments.sql). پس این دو policy
--    قدیمی که "فقط هنرجوی بدون‌استاد" را قابل‌دیدن/claim‌کردن می‌کرد
--    حذف می‌شود، و یک policy عمومی‌تر جایگزینش می‌شود تا استاد بتواند
--    هر هنرجویی را با ایمیل پیدا کند (حتی اگر از قبل استاد دیگری دارد).
DROP POLICY IF EXISTS "teacher see unclaimed students" ON profiles;
DROP POLICY IF EXISTS "teacher claim student" ON profiles;
CREATE POLICY "teacher lookup students" ON profiles FOR SELECT USING (role = 'student');

-- ۲. پرداخت‌ها دیگر بر اساس profiles.teacher_id (که فقط یک استاد را
--    نگه می‌داشت) به استاد مرتبط نمی‌شوند، بلکه بر اساس enrollment_id
DROP POLICY IF EXISTS "teacher select payments for own students" ON payments;
DROP POLICY IF EXISTS "teacher insert payments for own students" ON payments;
DROP POLICY IF EXISTS "teacher update payments for own students" ON payments;

CREATE POLICY "teacher select payments for own enrollments" ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM enrollments e WHERE e.id = payments.enrollment_id AND e.teacher_id = auth.uid()));
CREATE POLICY "teacher insert payments for own enrollments" ON payments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM enrollments e WHERE e.id = payments.enrollment_id AND e.teacher_id = auth.uid()));
CREATE POLICY "teacher update payments for own enrollments" ON payments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM enrollments e WHERE e.id = payments.enrollment_id AND e.teacher_id = auth.uid()));

-- attendance نیازی به تغییر ندارد — از قبل با teacher_id=auth.uid() درست
-- محدود شده بود.

SELECT 'Enrollments cutover complete.' AS status;
