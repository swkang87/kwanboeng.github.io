-- ============================================================
-- 계약서 원본 PDF 보관용 Storage 버킷 (project.html 계약서 자동등록)
--   · 버킷 이름은 config.js 의 CONTRACT_IMPORT.PDF_BUCKET 과 같아야 한다.
--     다른 회사에 납품할 때 이름을 바꾸면 아래 'contract-pdfs' 4곳을 함께 바꾼다.
--   · 파일 경로 규칙: <프로젝트ID>/<계약번호>.pdf  (DB 컬럼 추가 없음)
--   · 비공개 버킷. 읽기·쓰기 모두 admin 또는 관리팀만 (get_my_role / is_admin_team 헬퍼 사용).
--   · 여러 번 실행해도 안전하다.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-pdfs', 'contract-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

drop policy if exists contract_pdfs_select on storage.objects;
drop policy if exists contract_pdfs_insert on storage.objects;
drop policy if exists contract_pdfs_update on storage.objects;
drop policy if exists contract_pdfs_delete on storage.objects;

create policy contract_pdfs_select on storage.objects for select to authenticated
  using (bucket_id = 'contract-pdfs' and (public.get_my_role() = 'admin' or public.is_admin_team()));

create policy contract_pdfs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'contract-pdfs' and (public.get_my_role() = 'admin' or public.is_admin_team()));

create policy contract_pdfs_update on storage.objects for update to authenticated
  using      (bucket_id = 'contract-pdfs' and (public.get_my_role() = 'admin' or public.is_admin_team()))
  with check (bucket_id = 'contract-pdfs' and (public.get_my_role() = 'admin' or public.is_admin_team()));

create policy contract_pdfs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'contract-pdfs' and (public.get_my_role() = 'admin' or public.is_admin_team()));

-- 확인용
-- select id, public, file_size_limit from storage.buckets where id = 'contract-pdfs';
-- select policyname, cmd from pg_policies where schemaname = 'storage' and policyname like 'contract_pdfs_%';
