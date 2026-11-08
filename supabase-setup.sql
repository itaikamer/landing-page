-- טבלת הפניות מטופס "השאירו פרטים".
-- כבר הורץ בפרויקט "landing page test" (5.11.2026). לפרויקט חדש: SQL Editor → New query → Run.
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 200),
  phone text not null check (char_length(phone) between 1 and 50),
  email text not null check (char_length(email) between 1 and 200),
  created_at timestamptz not null default now()
);

-- נועלים את הטבלה, ופותחים רק דבר אחד: האתר (עם המפתח הציבורי) יכול להוסיף פנייה.
-- לקרוא, לשנות או למחוק פניות אפשר רק מתוך Supabase עצמו.
alter table public.leads enable row level security;
create policy "website can add leads" on public.leads
  for insert to anon with check (true);
