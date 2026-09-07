-- ══════════════════════════════════════════════════
-- ZANGOULEH — Allow teachers to edit/delete their own attendance
-- این فایل را در Supabase SQL Editor اجرا کنید
-- ══════════════════════════════════════════════════
-- لازم برای «جدول حضور‌وغیاب ماهانه» — استاد باید بتواند روی یک
-- سلول کلیک کند تا وضعیت را عوض کند (که یعنی UPDATE) یا آن را خالی
-- کند (که یعنی DELETE). قبلاً فقط INSERT مجاز بود.

CREATE POLICY "teacher update own attendance" ON attendance FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "teacher delete own attendance" ON attendance FOR DELETE
  USING (teacher_id = auth.uid());

SELECT 'Teacher attendance edit/delete policies added.' AS status;
