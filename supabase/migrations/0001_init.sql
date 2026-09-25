-- Qurious database schema (Supabase / Postgres).
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
--
-- Privacy by design:
--   * Study data is keyed by a random pseudonymous research id (e.g. "P-7F3K9Q2M"), never by
--     an auth user id, name, email or IP address. The two can't be joined.
--   * Study tables have RLS enabled and NO policies: only the backend (secret key) can read or
--     write them. Browsers can't read anyone's study data, including their own.
--   * Deleting a participant (withdrawal) cascades to all of their study rows.

-- ---------------------------------------------------------------------------------------
-- Study
-- ---------------------------------------------------------------------------------------

create table if not exists participants (
    id text primary key,                    -- pseudonymous research id
    created_at timestamptz not null default now(),
    study_code text,                        -- optional cohort code handed out by the researcher
    consent_version text not null,
    consented_at timestamptz not null
);

create table if not exists study_events (
    id bigint generated always as identity primary key,
    participant_id text not null references participants(id) on delete cascade,
    session_id text not null,
    type text not null,
    concept_id text,
    question_id text,
    payload jsonb not null default '{}'::jsonb,
    client_at timestamptz,
    received_at timestamptz not null default now()
);
create index if not exists study_events_participant on study_events (participant_id, received_at);

create table if not exists test_responses (
    id bigint generated always as identity primary key,
    participant_id text not null references participants(id) on delete cascade,
    test text not null check (test in ('pre', 'post')),
    item_id text not null,
    choice integer not null,
    correct boolean not null,
    ms integer,
    created_at timestamptz not null default now(),
    unique (participant_id, test, item_id)
);

-- v2 free-text questions and how the router mapped them (not linked to any participant).
create table if not exists question_log (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    raw_text text not null,
    status text not null,
    targets jsonb not null default '[]'::jsonb,
    uncovered jsonb not null default '[]'::jsonb,
    method text not null
);

alter table participants enable row level security;
alter table study_events enable row level security;
alter table test_responses enable row level security;
alter table question_log enable row level security;
-- (No policies: only the backend's secret key, which bypasses RLS, can access these.)

-- ---------------------------------------------------------------------------------------
-- Learner progress (optional accounts). One row per auth user, written from the browser.
-- ---------------------------------------------------------------------------------------

create table if not exists progress (
    user_id uuid primary key references auth.users(id) on delete cascade,
    journeys jsonb not null default '{}'::jsonb,   -- question id → saved journey state
    updated_at timestamptz not null default now()
);

alter table progress enable row level security;

create policy "Users read their own progress" on progress
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their own progress" on progress
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own progress" on progress
    for update to authenticated using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
