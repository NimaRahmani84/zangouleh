-- ══════════════════════════════════════════════════
-- ZANGOULEH — Profile self-edit, Teacher→Student messages, reminder flag
-- این فایل را در Supabase SQL Editor اجرا کنید
-- ══════════════════════════════════════════════════

-- ۱. برای تشخیص این‌که آیا برای این پکیج (این ردیف payments) قبلاً
--    یادآوری «۱ جلسه باقی‌مانده» فرستاده شده یا نه (جلوگیری از ارسال تکراری)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- ۲. تا الان هیچ policy ای اجازه نمی‌داد کاربر پروفایل خودش را ویرایش کند
--    (فقط ادمین می‌تونست). این policy این اجازه رو می‌ده، ولی به‌تنهایی
--    خطرناکه (چون RLS سطح-ردیفیه نه سطح-ستونی) — یعنی بدون قدم بعدی،
--    یک هنرجو می‌تونست role خودش رو با یک درخواست خام به admin تغییر بده.
CREATE POLICY "own profile update" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ۳. همین‌جا جلوی اون خطر رو می‌گیریم: هر کاربر فقط full_name خودش رو
--    می‌تونه عوض کنه؛ role/teacher_id/instrument/email حتی اگه توی
--    درخواست UPDATE فرستاده بشه، به مقدار قبلی برمی‌گرده — مگر این‌که
--    ادمین (از طریق سرویس ادمین با service key) این کار رو انجام بده.
CREATE OR REPLACE FUNCTION prevent_profile_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT is_admin() THEN
    NEW.role := OLD.role;
    NEW.teacher_id := OLD.teacher_id;
    NEW.instrument := OLD.instrument;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_self_escalation ON profiles;
CREATE TRIGGER trg_prevent_profile_self_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profile_self_escalation();

-- ۴. پیام‌های یک‌طرفه‌ی استاد به هنرجو (فقط استاد می‌فرسته، هنرجو فقط می‌خونه)
CREATE TABLE IF NOT EXISTS teacher_messages (
  id SERIAL PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teacher_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher send messages to own students" ON teacher_messages FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (SELECT 1 FROM enrollments e WHERE e.teacher_id = auth.uid() AND e.student_id = teacher_messages.student_id)
  );
CREATE POLICY "teacher view own sent messages" ON teacher_messages FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "student view own received messages" ON teacher_messages FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "admin messages select" ON teacher_messages FOR SELECT USING (is_admin());

-- ۵. teacher_name رو از سمت کلاینت قبول نمی‌کنیم (ممکنه جعل بشه)، همیشه
--    خودمون از پروفایل واقعی استاد پرش می‌کنیم
CREATE OR REPLACE FUNCTION set_teacher_message_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT full_name INTO NEW.teacher_name FROM profiles WHERE id = NEW.teacher_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_teacher_message_name ON teacher_messages;
CREATE TRIGGER trg_set_teacher_message_name
  BEFORE INSERT ON teacher_messages
  FOR EACH ROW EXECUTE FUNCTION set_teacher_message_name();

CREATE INDEX IF NOT EXISTS idx_teacher_messages_student ON teacher_messages(student_id, created_at DESC);

SELECT 'Profile self-edit + teacher messages schema created.' AS status;
