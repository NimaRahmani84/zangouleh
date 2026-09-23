-- ══════════════════════════════════════════════════
-- ZANGOULEH — Multi-Teacher Enrollments (additive, safe to run anytime)
-- این فایل را در Supabase SQL Editor اجرا کنید
-- ══════════════════════════════════════════════════
-- تا الان هر هنرجو فقط می‌توانست یک teacher_id داشته باشد (یعنی همزمان
-- فقط با یک استاد). این فایل جدول enrollments را اضافه می‌کند تا یک
-- هنرجو بتواند همزمان با چند استاد مختلف (یا چند ساز با یک استاد)
-- ثبت‌نام داشته باشد، بدون این‌که حقوق/جلسات این استادها با هم قاطی شود.

-- ۱. یک ردیف enrollment یعنی: این هنرجو، این ساز را، با این استاد می‌خواند
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teacher_name TEXT,
  instrument TEXT NOT NULL DEFAULT '',
  enrolled_via TEXT DEFAULT 'school' CHECK (enrolled_via IN ('school','instructor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, teacher_id, instrument)
);
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own enrollments student" ON enrollments FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "own enrollments teacher" ON enrollments FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "admin enrollments select" ON enrollments FOR SELECT USING (is_admin());
CREATE POLICY "admin enrollments insert" ON enrollments FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin enrollments update" ON enrollments FOR UPDATE USING (is_admin());
CREATE POLICY "admin enrollments delete" ON enrollments FOR DELETE USING (is_admin());

-- استاد فقط می‌تواند برای یک هنرجوی واقعی (role='student') برای خودش ثبت‌نام بسازد
CREATE POLICY "teacher claim student enrollment" ON enrollments FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = enrollments.student_id AND p.role = 'student')
  );
-- عمداً UPDATE برای استاد نداریم: enrolled_via درصد حقوق خودش را تعیین
-- می‌کند و طبق همان قانونی که قبلاً روی profiles گذاشتیم (تضاد منافع)،
-- فقط ادمین می‌تواند تغییرش بدهد.

-- ۲. پرداخت و حضور‌وغیاب حالا به یک ثبت‌نام مشخص (enrollment) وصل می‌شوند
--    تا وقتی یک هنرجو چند استاد/ساز دارد، جلسات و پول هر کدام قاطی نشود
ALTER TABLE payments ADD COLUMN IF NOT EXISTS enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE SET NULL;

-- ۳. بازپرکردن داده‌های قبلی — امروز هر هنرجوی claim‌شده دقیقاً یک استاد
--    دارد، پس این migration بدون ابهام است
INSERT INTO enrollments (student_id, teacher_id, teacher_name, instrument, enrolled_via, created_at)
SELECT id, teacher_id, teacher_name, COALESCE(instrument,''), COALESCE(enrolled_via,'school'), created_at
FROM profiles
WHERE role = 'student' AND teacher_id IS NOT NULL
ON CONFLICT (student_id, teacher_id, instrument) DO NOTHING;

UPDATE payments p
SET enrollment_id = e.id
FROM profiles pr
JOIN enrollments e ON e.student_id = pr.id
WHERE pr.email = p.student_email AND p.enrollment_id IS NULL;

UPDATE attendance a
SET enrollment_id = e.id
FROM enrollments e
WHERE e.student_id = a.student_id AND e.teacher_id = a.teacher_id AND a.enrollment_id IS NULL;

SELECT 'Enrollments schema created and backfilled.' AS status;

-- ══════════════════════════════════════════════════
-- بعد از اجرا، این سه کوئری را دستی اجرا کنید و مطمئن شوید هر سه صفر
-- ردیف برمی‌گردانند (یعنی migration درست انجام شده):
--
-- SELECT student_id, count(*) FROM enrollments GROUP BY student_id HAVING count(*) > 1;
--
-- SELECT pay.* FROM payments pay JOIN profiles pr ON pr.email = pay.student_email
--   WHERE pr.teacher_id IS NOT NULL AND pay.enrollment_id IS NULL;
--
-- SELECT * FROM attendance WHERE enrollment_id IS NULL;
-- ══════════════════════════════════════════════════
