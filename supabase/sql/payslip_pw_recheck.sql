-- 저장소 사본 — 원본·스냅샷·롤백·시험은 저장소 밖 security-fix/154~157_payslip_pw_*. 2026-11-03 적용 완료(Supabase).
-- 155 급여명세서 본인 확인: 생년월일 → 계정 비밀번호 재입력 (2026-11-03) — 적용
-- 영향 범위:
--   + 함수 payslip_verify_pw(p_token)  : 방금 비밀번호로 로그인한 세션(JWT amr password 시각이 120초 안)이면 이 창 토큰을 통과시킨다.
--                                        통과 기록·유지 시간·세션 묶음은 기존 payslip_verify 와 같다(payslip_unlocks, unlock_minutes).
--   + 함수 payslip_pw_fail(p_count)    : 화면에서 비밀번호가 틀렸을 때 기록만 남긴다(payslip_verify_logs 'fail', detail 'n/5 비밀번호').
--   - payslip_verify(생년월일) 실행 권한을 authenticated 에서 회수(함수는 남김 — 삭제 안 함). 화면에서 쓰지 않는 길을 서버에서도 막음.
--   데이터 행 변경·삭제 없음. 표 구조 변경 없음.
begin;

create or replace function public.payslip_verify_pw(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid; v_name text; c record; v_until timestamptz; v_ts bigint;
begin
  select u.id, u.name into v_uid, v_name from public.users u where u.auth_id = auth.uid() limit 1;
  if v_uid is null then raise exception '사용자 정보를 확인할 수 없습니다.' using errcode = '42501'; end if;
  if p_token is null or length(p_token) < 32 then return jsonb_build_object('status', 'invalid'); end if;

  -- 이 세션이 비밀번호로 열린 시각(서명된 JWT 안 값 — 클라이언트가 바꿀 수 없음)
  select max((e ->> 'timestamp')::bigint) into v_ts
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
   where e ->> 'method' = 'password' and (e ->> 'timestamp') ~ '^\d+$';
  if v_ts is null or v_ts < extract(epoch from now())::bigint - 120 then
    return jsonb_build_object('status', 'stale');
  end if;

  select * into c from public.payslip_cfg();
  delete from public.payslip_unlocks where user_id = v_uid and unlocked_until <= now();
  v_until := now() + make_interval(mins => c.unlock_minutes);
  insert into public.payslip_unlocks (user_id, token_hash, session_id, unlocked_until)
  values (v_uid, encode(sha256(convert_to(p_token, 'UTF8')), 'hex'), coalesce(auth.jwt() ->> 'session_id', ''), v_until)
  on conflict (user_id, token_hash) do update
    set session_id = excluded.session_id, unlocked_until = excluded.unlocked_until, created_at = now();
  insert into public.payslip_verify_logs (user_id, user_name, event, detail) values (v_uid, v_name, 'success', '비밀번호');
  return jsonb_build_object('status', 'ok', 'unlocked_until', v_until);
end
$$;

create or replace function public.payslip_pw_fail(p_count integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid; v_name text; c record;
begin
  select u.id, u.name into v_uid, v_name from public.users u where u.auth_id = auth.uid() limit 1;
  if v_uid is null then raise exception '사용자 정보를 확인할 수 없습니다.' using errcode = '42501'; end if;
  if p_count is null or p_count < 1 or p_count > 99 then return; end if;
  select * into c from public.payslip_cfg();
  insert into public.payslip_verify_logs (user_id, user_name, event, detail)
  values (v_uid, v_name, 'fail', p_count || '/' || c.max_fails || ' 비밀번호');
end
$$;

revoke all on function public.payslip_verify_pw(text) from public, anon;
revoke all on function public.payslip_pw_fail(integer) from public, anon;
grant execute on function public.payslip_verify_pw(text) to authenticated;
grant execute on function public.payslip_pw_fail(integer) to authenticated;

revoke execute on function public.payslip_verify(text, text) from authenticated;

commit;
