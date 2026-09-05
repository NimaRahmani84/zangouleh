-- ══════════════════════════════════════════════════
-- ZANGOULEH — Sessions Tracking + Payroll Split
-- این فایل را در Supabase SQL Editor اجرا کنید
-- ══════════════════════════════════════════════════

-- ۱. منبع ثبت‌نام هنرجو — تعیین می‌کند چند درصد حقوق استاد است
--    school     → هنرجو از طریق زنگوله آمده → ۶۰٪ استاد / ۴۰٪ مدرسه
--    instructor → هنرجو از طریق خود استاد آمده → ۷۰٪ استاد / ۳۰٪ مدرسه
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enrolled_via TEXT DEFAULT 'school'
  CHECK (enrolled_via IN ('school','instructor'));

-- ۲. اطلاعات پکیج روی هر پرداخت — برای محاسبه جلسات باقی‌مانده و نرخ هر جلسه
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_sessions INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- ۳. وضعیت حضور‌وغیاب را با منطق واقعی مدرسه تطبیق بده:
--    present   → حضور (۱ جلسه کم می‌شود)
--    excused   → غیبت موجه (کم نمی‌شود)
--    unexcused → غیبت غیرموجه (کم می‌شود، مگر در پکیج ۱۲ جلسه تا ۲ بار رایگان است)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present','excused','unexcused'));

-- ۴. فقط ادمین بتواند enrolled_via را تغییر دهد (استاد نباید خودش تعیین کند، تضاد منافع دارد)
DROP POLICY IF EXISTS "admin update profiles" ON profiles;
CREATE POLICY "admin update profiles" ON profiles FOR UPDATE USING (is_admin());

SELECT 'Sessions + payroll schema updated.' AS status;
