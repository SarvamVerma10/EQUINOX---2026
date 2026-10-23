-- ============================================================================
-- WasteWise PostgreSQL Schema & Row-Level Security (Supabase)
-- Preserves guide versions, source excerpts, scan history, and non-destructive
-- user corrections queue.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- 1. Waste Guides Table (Versioned Local Waste-Management Guides)
create table if not exists public.waste_guides (
  id uuid primary key default uuid_generate_v4(),
  locality_name text not null,
  guide_name text not null,
  issuing_authority text not null,
  version text not null,
  effective_date date,
  is_active boolean not null default false,
  is_demo boolean not null default false,
  extraction_warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 2. Guide Rules Table (Searchable Passages with Page & Section Provenance)
create table if not exists public.waste_guide_rules (
  id uuid primary key default uuid_generate_v4(),
  guide_id uuid not null references public.waste_guides(id) on delete cascade,
  item_keywords text[] not null,
  material_keywords text[] not null default '{}',
  subtype text,
  category text not null check (category in ('biodegradable', 'dry_recyclable', 'special_handling', 'unresolved')),
  instructions text[] not null default '{}',
  page_number integer,
  section_heading text,
  exact_excerpt text not null,
  physical_bin_note text,
  created_at timestamptz not null default now()
);

-- 3. Scan History Table (User-owned or Session-scoped Scan Records)
-- Note: Uploaded photos are NOT stored by default to protect privacy.
create table if not exists public.scan_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_session_id text,
  status text not null check (status in ('identified', 'clarification_needed', 'recommended', 'unresolved', 'error')),
  identified_item_name text not null,
  identified_material text not null,
  components jsonb not null default '[]'::jsonb,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  category text check (category in ('biodegradable', 'dry_recyclable', 'special_handling', 'unresolved')),
  instructions jsonb not null default '[]'::jsonb,
  guide_id uuid references public.waste_guides(id) on delete set null,
  guide_name text,
  guide_version text,
  source_page integer,
  source_section text,
  source_excerpt text,
  unresolved_reason text,
  corrected_item_name text,
  correction_notes text,
  Optional_photo_consent boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4. User Corrections & Feedback Review Queue
-- Corrections NEVER overwrite official guide rules or other users' results automatically.
create table if not exists public.identification_corrections (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid references public.scan_history(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  original_item_name text not null,
  original_material text,
  original_category text,
  corrected_item_name text not null,
  corrected_material text,
  suggested_part text,
  user_comment text,
  review_status text not null default 'pending_review' check (review_status in ('pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Enable Row-Level Security (RLS)
alter table public.waste_guides enable row level security;
alter table public.waste_guide_rules enable row level security;
alter table public.scan_history enable row level security;
alter table public.identification_corrections enable row level security;

-- Public read access to active/published waste guides and rules
create policy "Anyone can view waste guides"
  on public.waste_guides for select using (true);

create policy "Anyone can view waste guide rules"
  on public.waste_guide_rules for select using (true);

-- Authenticated users can only view, insert, update, or delete their own scan history
create policy "Users can view own scan history"
  on public.scan_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own scan history"
  on public.scan_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scan history corrections"
  on public.scan_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own scan history"
  on public.scan_history for delete
  using (auth.uid() = user_id);

-- Anyone can submit a correction to the review queue; users can view their own submissions
create policy "Users can submit identification corrections"
  on public.identification_corrections for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Users can view own submitted corrections"
  on public.identification_corrections for select
  using (auth.uid() = user_id);
