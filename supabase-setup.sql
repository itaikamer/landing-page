-- טבלת הפניות מטופס "השאירו פרטים", כולל שדות ה-CRM.
-- כבר הורץ בפרויקט "landing page test" (5.11 + CRM ב-11.11.2026). לפרויקט חדש: SQL Editor → New query → Run.
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 200),
  phone text not null check (char_length(phone) between 1 and 50),
  email text not null check (char_length(email) between 1 and 200),
  created_at timestamptz not null default now(),
  -- CRM: שלב, הערות, מתי לחזור, ומתי עודכן לאחרונה
  status text not null default 'new' check (status in ('new','contacted','meeting','won','lost')),
  notes text check (char_length(notes) <= 2000),
  follow_up date,
  updated_at timestamptz
);

-- נועלים את הטבלה, ופותחים רק דבר אחד: האתר (עם המפתח הציבורי) יכול להוסיף פנייה חדשה,
-- בלי שלב, הערות או תאריך. לקרוא ולעדכן אפשר רק עם המפתח הסודי (דף הפניות).
alter table public.leads enable row level security;
create policy "website can add leads" on public.leads
  for insert to anon
  with check (status = 'new' and notes is null and follow_up is null and updated_at is null);
