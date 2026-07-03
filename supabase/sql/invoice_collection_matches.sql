-- ============================================================
-- 매칭확인: 수동매칭 영속 + 확인완료(이상없음) 기록 테이블
-- Supabase SQL Editor에서 직접 실행 (승우님). 이 파일은 실행되지 않은 초안임.
--
-- · invoice_collection_matches: 수동매칭 저장(자동매칭은 매번 재계산, 저장 안 함)
-- · invoice_collection_reviews: 미수금/미발행 의심 건 "확인완료(이상없음)" 처리 기록
-- · RLS: admin+manager 전용 — tax_invoices_rls.sql과 동일 패턴
--
-- ⚠️ 원안 대비 변경 1건: matches의 FK에 on delete cascade 추가.
--   세금계산서 탭 삭제 기능(deleteTaxInvoice)이 tax_invoices 행을 지우는데,
--   cascade 없으면 매칭 기록이 있는 계산서 삭제가 FK 위반으로 실패함.
--   (reviews의 item_id는 polymorphic이라 FK 없음 — 원본 삭제 시 잔존 기록은
--    참조 대상이 없어 무해하며, 필요 시 수동 정리.)
-- ============================================================


-- ── ① 테이블 생성 ─────────────────────────────────────────────
create table if not exists public.invoice_collection_matches (
  id             uuid primary key default gen_random_uuid(),
  tax_invoice_id uuid not null references public.tax_invoices(id)  on delete cascade,
  collection_id  uuid not null references public.collections(id)   on delete cascade,
  match_type     text not null check (match_type in ('auto','manual')),
  created_by     uuid references public.users(id),
  created_at     timestamptz default now(),
  unique (tax_invoice_id, collection_id)
);

create table if not exists public.invoice_collection_reviews (
  id          uuid primary key default gen_random_uuid(),
  item_type   text not null check (item_type in ('tax_invoice','collection')),
  item_id     uuid not null,
  status      text not null default 'confirmed_ok',
  note        text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz default now(),
  unique (item_type, item_id)   -- 클라이언트 upsert onConflict:'item_type,item_id' 전제
);

create index if not exists ic_matches_collection_idx on public.invoice_collection_matches (collection_id);


-- ── ② RLS: admin+manager 전용 ────────────────────────────────
-- 권한 판정: tax_invoices_rls.sql / supply_records.sql 선택 블록과 동일 패턴.
-- 전제: users에 authenticated SELECT 정책 존재, auth_id=null 계정은 접근 불가.
alter table public.invoice_collection_matches enable row level security;
alter table public.invoice_collection_reviews enable row level security;

-- 재실행 대비: 두 테이블 기존 정책 이름 무관 일괄 drop
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('invoice_collection_matches', 'invoice_collection_reviews')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy ic_matches_select on public.invoice_collection_matches
  for select to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy ic_matches_insert on public.invoice_collection_matches
  for insert to authenticated
  with check (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy ic_matches_update on public.invoice_collection_matches
  for update to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  )
  with check (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy ic_matches_delete on public.invoice_collection_matches
  for delete to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy ic_reviews_select on public.invoice_collection_reviews
  for select to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy ic_reviews_insert on public.invoice_collection_reviews
  for insert to authenticated
  with check (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy ic_reviews_update on public.invoice_collection_reviews
  for update to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  )
  with check (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );

create policy ic_reviews_delete on public.invoice_collection_reviews
  for delete to authenticated
  using (
    exists (select 1 from public.users
             where auth_id = auth.uid() and role in ('admin','manager'))
  );


-- ── ③ 실행 후 검증 ───────────────────────────────────────────
-- 테이블당 4개, 총 8개 정책 확인
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('invoice_collection_matches', 'invoice_collection_reviews')
 order by tablename, cmd;
