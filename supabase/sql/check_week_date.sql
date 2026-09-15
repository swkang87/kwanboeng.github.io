-- ============================================================
-- weekly_reports.week_date 점검 — 월요일이 아닌 행 찾기
-- Supabase SQL Editor 에서 직접 실행 (조회 전용, 데이터 변경 없음)
--
-- 배경: import_weekly.html 의 주간보고 기준일은 <input type="date" id="weekDate">
--   값을 그대로 쓴다(432·491행). 라벨은 "주간보고 기준 주 (월요일)" 이지만
--   월요일인지 검사하는 코드가 없어 사람이 아무 요일이나 고를 수 있다.
--   → 아래 쿼리로 실제 데이터에 섞인 비월요일 행을 확인한다.
--
-- ※ B-3(parseXlDate 의 toISOString 제거)과는 무관하다.
--   parseXlDate 는 projects.start_date / end_date 에만 쓰이고
--   week_date 에는 전혀 관여하지 않는다. 자세한 내용은 보고 참조.
-- ============================================================


-- ── 0. 컬럼 타입 확인 ────────────────────────────────────────
-- week_date 가 date 가 아니라 text 면 아래 extract() 가 실패한다.
-- 그 경우 week_date 를 week_date::date 로 바꿔서 실행할 것.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('weekly_reports', 'projects')
  and column_name in ('week_date', 'start_date', 'end_date')
order by table_name, column_name;


-- ── 1. 요약: 요일별 건수 ─────────────────────────────────────
-- isodow: 1=월 2=화 3=수 4=목 5=금 6=토 7=일
select extract(isodow from week_date)::int as isodow,
       to_char(week_date, 'Dy')            as dow,
       count(*)                            as cnt,
       min(week_date)                      as first_date,
       max(week_date)                      as last_date
from public.weekly_reports
group by 1, 2
order by 1;


-- ── 2. 상세: 월요일이 아닌 행 전체 ───────────────────────────
-- monday_of_week = 그 주의 월요일 (보정할 경우의 목표값)
select wr.id,
       wr.week_date,
       to_char(wr.week_date, 'Dy')                     as dow,
       extract(isodow from wr.week_date)::int          as isodow,
       (wr.week_date
         - ((extract(isodow from wr.week_date)::int - 1) || ' days')::interval
       )::date                                         as monday_of_week,
       wr.project_id,
       p.name                                          as project_name,
       wr.progress_pct,
       wr.prev_pct
from public.weekly_reports wr
left join public.projects p on p.id = wr.project_id
where extract(isodow from wr.week_date) <> 1
order by wr.week_date desc, p.name;


-- ── 3. 보정 시 충돌 여부 미리 확인 ───────────────────────────
-- week_date 를 그 주 월요일로 옮기면 (project_id, week_date) 가 겹칠 수 있다.
-- 아래가 0건이어야 단순 UPDATE 로 보정 가능하다. 1건 이상이면 어느 행을
-- 남길지 먼저 정해야 한다.
with fix as (
  select wr.id,
         wr.project_id,
         wr.week_date,
         (wr.week_date
           - ((extract(isodow from wr.week_date)::int - 1) || ' days')::interval
         )::date as target_date
  from public.weekly_reports wr
  where extract(isodow from wr.week_date) <> 1
)
select f.id            as moving_row_id,
       f.project_id,
       f.week_date     as from_date,
       f.target_date   as to_date,
       exist.id        as conflicting_row_id
from fix f
join public.weekly_reports exist
  on exist.project_id = f.project_id
 and exist.week_date  = f.target_date
 and exist.id <> f.id
order by f.week_date desc;


-- ── 4. (참고) 보정 UPDATE — 3번이 0건일 때만, 확인 후 주석 해제 ──
-- 실행 전 2번 결과를 반드시 눈으로 확인할 것. 되돌릴 수 없다.
--
-- update public.weekly_reports
--    set week_date = (week_date
--                      - ((extract(isodow from week_date)::int - 1) || ' days')::interval
--                    )::date
--  where extract(isodow from week_date) <> 1;


-- ── 5. (별건) projects 날짜 정합성 ───────────────────────────
-- parseXlDate 가 실제로 쓰이는 곳은 projects.start_date / end_date 다(295·296행).
-- 하루 밀림 자체는 원본 엑셀 없이 판별할 수 없으므로, 대신 명백한 이상만 본다.
select id, name, start_date, end_date
from public.projects
where start_date is not null
  and end_date is not null
  and end_date < start_date
order by name;
