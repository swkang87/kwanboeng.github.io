-- ============================================================
--  project_events -> work_logs.linked_events 자동 동기화 (Task 1)
--  · 대상 유형: type IN ('보고회','위원회')  (그 외 유형은 무시)
--  · 반영 대상: 해당 project.pm_id 직원의 event_date 업무일지 1건
--  · INSERT/UPDATE -> 링크 추가(중복/note 보존), DELETE/유형변경/이동 -> 링크 제거
--  · PM이 아닌 사람 업무일지에는 손대지 않음
--  · PM의 해당일 업무일지가 없으면 빈 업무일지를 새로 생성(create-if-missing)
--  · 기존 앱이 이미 읽는 linked_events 컬럼 사용 -> 스키마 변경 불필요
--
--  실행 순서: ① 트리거 생성 → ② 백필 미리보기 → ③ 백필 → ④ 검증
-- ============================================================


-- ============================================================
-- ① 트리거 (함수 + 트리거)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_event_to_worklog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _types text[] := ARRAY['보고회','위원회'];
  _pm    uuid;
BEGIN
  -- ===== DELETE =====
  IF (TG_OP = 'DELETE') THEN
    UPDATE work_logs w
       SET linked_events = COALESCE((
             SELECT jsonb_agg(e)
               FROM jsonb_array_elements(w.linked_events) e
              WHERE e->>'event_id' <> OLD.id::text
           ), '[]'::jsonb)
     WHERE EXISTS (
             SELECT 1 FROM jsonb_array_elements(w.linked_events) e
              WHERE e->>'event_id' = OLD.id::text
           );
    RETURN OLD;
  END IF;

  -- ===== UPDATE: 대상 이탈/날짜·프로젝트 변경 시 OLD 링크 정리 =====
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.type = ANY(_types))
       AND ( NOT (NEW.type = ANY(_types))
             OR NEW.event_date IS DISTINCT FROM OLD.event_date
             OR NEW.project_id IS DISTINCT FROM OLD.project_id )
    THEN
      UPDATE work_logs w
         SET linked_events = COALESCE((
               SELECT jsonb_agg(e)
                 FROM jsonb_array_elements(w.linked_events) e
                WHERE e->>'event_id' <> OLD.id::text
             ), '[]'::jsonb)
       WHERE EXISTS (
               SELECT 1 FROM jsonb_array_elements(w.linked_events) e
                WHERE e->>'event_id' = OLD.id::text
             );
    END IF;
  END IF;

  -- ===== INSERT / UPDATE: 대상 유형이면 NEW 링크 반영 (없으면 빈 일지 생성) =====
  IF (NEW.type = ANY(_types)) THEN
    SELECT p.pm_id INTO _pm FROM projects p WHERE p.id = NEW.project_id;

    IF _pm IS NOT NULL AND NEW.event_date IS NOT NULL THEN
      INSERT INTO work_logs (user_id, log_date, tasks, tomorrow_tasks, issues,
                             overtime, linked_events, updated_at)
      VALUES (_pm, NEW.event_date, '[]'::jsonb, '[]'::jsonb, '',
              false,
              jsonb_build_array(jsonb_build_object('event_id', NEW.id, 'note', '')),
              now())
      ON CONFLICT (user_id, log_date) DO UPDATE
        SET linked_events =
              CASE WHEN EXISTS (
                     SELECT 1 FROM jsonb_array_elements(work_logs.linked_events) e
                      WHERE e->>'event_id' = NEW.id::text
                   )
                   THEN work_logs.linked_events
                   ELSE COALESCE(work_logs.linked_events, '[]'::jsonb)
                        || jsonb_build_object('event_id', NEW.id, 'note', '')
              END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_event_to_worklog ON project_events;
CREATE TRIGGER trg_sync_event_to_worklog
AFTER INSERT OR UPDATE OR DELETE ON project_events
FOR EACH ROW
EXECUTE FUNCTION sync_event_to_worklog();


-- ============================================================
-- ② 백필 실행 전 미리보기
-- ============================================================
-- 반영 예정 이벤트 수
SELECT count(*) AS 반영대상_이벤트수
FROM project_events pe
JOIN projects p ON p.id = pe.project_id
WHERE pe.type IN ('보고회','위원회')
  AND pe.event_date IS NOT NULL
  AND p.pm_id IS NOT NULL;

-- 새로 생성될 빈 업무일지 수
SELECT count(*) AS 신규생성_예상_업무일지
FROM (
  SELECT DISTINCT p.pm_id AS uid, pe.event_date AS d
  FROM project_events pe
  JOIN projects p ON p.id = pe.project_id
  WHERE pe.type IN ('보고회','위원회')
    AND pe.event_date IS NOT NULL
    AND p.pm_id IS NOT NULL
) x
LEFT JOIN work_logs w ON w.user_id = x.uid AND w.log_date = x.d
WHERE w.id IS NULL;


-- ============================================================
-- ③ 백필 실행 SQL (트리거와 동일 로직: 중복/note 보존 + 없으면 빈 일지 생성)
-- ============================================================
DO $$
DECLARE
  r   RECORD;
  _pm uuid;
BEGIN
  FOR r IN
    SELECT pe.id, pe.project_id, pe.event_date
      FROM project_events pe
     WHERE pe.type IN ('보고회','위원회')
       AND pe.event_date IS NOT NULL
  LOOP
    SELECT p.pm_id INTO _pm FROM projects p WHERE p.id = r.project_id;
    IF _pm IS NULL THEN CONTINUE; END IF;

    INSERT INTO work_logs (user_id, log_date, tasks, tomorrow_tasks, issues,
                           overtime, linked_events, updated_at)
    VALUES (_pm, r.event_date, '[]'::jsonb, '[]'::jsonb, '',
            false,
            jsonb_build_array(jsonb_build_object('event_id', r.id, 'note', '')),
            now())
    ON CONFLICT (user_id, log_date) DO UPDATE
      SET linked_events =
            CASE WHEN EXISTS (
                   SELECT 1 FROM jsonb_array_elements(work_logs.linked_events) e
                    WHERE e->>'event_id' = r.id::text
                 )
                 THEN work_logs.linked_events
                 ELSE COALESCE(work_logs.linked_events, '[]'::jsonb)
                      || jsonb_build_object('event_id', r.id, 'note', '')
            END;
  END LOOP;
END $$;


-- ============================================================
-- ④ 실행 후 검증 (선택)
-- ============================================================
SELECT w.user_id, w.log_date, w.linked_events
  FROM work_logs w
 WHERE jsonb_array_length(COALESCE(w.linked_events, '[]'::jsonb)) > 0
 ORDER BY w.log_date DESC
 LIMIT 30;
