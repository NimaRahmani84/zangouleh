-- ══════════════════════════════════════════════════
-- ZANGOULEH PORTAL — Supabase Setup
-- این فایل را در Supabase SQL Editor اجرا کنید
-- ══════════════════════════════════════════════════

-- helper: check if current user is admin (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- ۱. پروفایل کاربران (دانش‌آموز / استاد / ادمین)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  instrument TEXT,
  teacher_name TEXT,
  teacher_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "teacher own students" ON profiles FOR SELECT USING (teacher_id = auth.uid());

-- ۲. پرداخت‌ها
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  student_email TEXT NOT NULL,
  amount NUMERIC,
  package TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('paid','pending','overdue')),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own payments" ON payments FOR SELECT USING (student_email = auth.email());
CREATE POLICY "admin payments select" ON payments FOR SELECT USING (is_admin());
CREATE POLICY "admin payments insert" ON payments FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admin payments update" ON payments FOR UPDATE USING (is_admin());

-- ۳. حضور و غیاب
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  student_id UUID REFERENCES profiles(id),
  teacher_id UUID REFERENCES profiles(id),
  date DATE NOT NULL,
  status TEXT DEFAULT 'present' CHECK (status IN ('present','absent','late')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own attendance student" ON attendance FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "own attendance teacher" ON attendance FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "admin attendance select" ON attendance FOR SELECT USING (is_admin());
CREATE POLICY "teacher insert attendance" ON attendance FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "admin insert attendance" ON attendance FOR INSERT WITH CHECK (is_admin());

-- ══════════════════════════════════════════════════
SELECT 'Portal schema created successfully.' AS status;
