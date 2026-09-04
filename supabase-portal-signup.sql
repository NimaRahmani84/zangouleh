-- ══════════════════════════════════════════════════
-- ZANGOULEH PORTAL — Student Self-Signup + Teacher Roster/Payments
-- این فایل را در Supabase SQL Editor اجرا کنید
-- ══════════════════════════════════════════════════

-- ۱. وقتی کاربر جدید در auth.users ساخته می‌شود، خودکار یک پروفایل با نقش
--    'student' برایش بساز. SECURITY DEFINER یعنی این تابع RLS را دور می‌زند،
--    و چون role همیشه 'student' هاردکد شده، کاربر نمی‌تواند نقش خودش را
--    از طریق فرم ثبت‌نام دستکاری کند.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'student')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ۲. ادمین می‌تواند هر پروفایلی را ویرایش کند (مثلاً تغییر نقش یا استاد)
CREATE POLICY "admin update profiles" ON profiles FOR UPDATE USING (is_admin());

-- ۳. استاد می‌تواند یک هنرجوی بدون استاد (یا هنرجوی خودش) را به خودش نسبت دهد
CREATE POLICY "teacher claim student" ON profiles FOR UPDATE
  USING (role = 'student' AND (teacher_id IS NULL OR teacher_id = auth.uid()))
  WITH CHECK (role = 'student' AND teacher_id = auth.uid());

-- ۴. استاد بتواند برای هنرجوهای خودش پرداخت ثبت/ویرایش/مشاهده کند
CREATE POLICY "teacher select payments for own students" ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.email = payments.student_email AND p.teacher_id = auth.uid()));

CREATE POLICY "teacher insert payments for own students" ON payments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.email = payments.student_email AND p.teacher_id = auth.uid()));

CREATE POLICY "teacher update payments for own students" ON payments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.email = payments.student_email AND p.teacher_id = auth.uid()));

-- ══════════════════════════════════════════════════
SELECT 'Signup trigger + teacher policies created.' AS status;
