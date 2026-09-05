-- ══════════════════════════════════════════════════
-- ZANGOULEH — Fix: allow deleting users from Supabase Auth
-- این فایل را در Supabase SQL Editor اجرا کنید
-- ══════════════════════════════════════════════════
-- مشکل: حذف یک کاربر باعث خطای "Database error deleting user" می‌شد،
-- چون attendance.student_id / attendance.teacher_id و خودارجاعی
-- profiles.teacher_id هیچ قانون ON DELETE نداشتند (پیش‌فرض RESTRICT).

ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE attendance DROP CONSTRAINT attendance_teacher_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE profiles DROP CONSTRAINT profiles_teacher_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE SET NULL;

SELECT 'Delete-cascade fix applied.' AS status;
