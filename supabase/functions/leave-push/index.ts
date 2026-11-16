// Supabase Edge Function: leave-push — 연차 결재 요청 웹 푸시 (2026-11-16, v2.11.0)
//
// 호출자 인증 (verify_jwt = false — 아래에서 직접 확인한다)
//   · DB 트리거(leave_requests_push → pg_net): x-hook-token 헤더 → DB 함수 push_hook_ok 로 Vault 값과 대조
//       action 'leave' {request_id} : 그 신청의 결재자(leave_approval_kind — my_pending_approvals 와 같은 판정) 기기에 알림
//       action 'init'               : VAPID 키가 없으면 만들어 Vault 에 넣고 공개키를 돌려준다(처음 한 번, 이미 있으면 그대로)
//   · 직원 화면(내 정보 「시험 알림」): Authorization: Bearer <로그인 JWT> → 본인 기기에만 시험 알림 1건
//       action 'self_test'
// 알림 내용 = 제목(연차 결재 요청 / 연차 취소 요청) · 이름 · 종류 · 날짜 — 사유는 넣지 않는다(잠금 화면에 보임).
// 결과: 성공 → last_success_at, 410·404(사라진 구독) → 삭제, 그 밖 실패 → fail_count (push_mark)
// 비밀키는 Vault(push_vapid_private)에만 있고 service_role 함수 push_vapid_get 으로만 읽는다. 외부 라이브러리 없음(webpush.ts).
// 필요한 값: Supabase 기본 SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. 선택 PUSH_SUBJECT(VAPID 연락처, 없으면 SUPABASE_URL).

import { generateVapidKeys, sendPush, type PushSub } from './webpush.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const URL_ = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUBJECT = Deno.env.get('PUSH_SUBJECT') || URL_

async function rpc(fn: string, args: Record<string, unknown>): Promise<{ data: any; error: string | null }> {
  const res = await fetch(URL_ + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  if (!res.ok) return { data: null, error: res.status + ' ' + text.slice(0, 200) }
  try { return { data: text ? JSON.parse(text) : null, error: null } } catch { return { data: text, error: null } }
}

async function vapid(): Promise<{ publicKey: string; privateJwk: string; subject: string } | null> {
  const { data, error } = await rpc('push_vapid_get', {})
  if (error || !data || !data.public || !data.private) return null
  return { publicKey: data.public, privateJwk: data.private, subject: SUBJECT }
}

const WD = ['일', '월', '화', '수', '목', '금', '토']
function md(d: string): string {
  const [y, m, dd] = d.split('-').map(Number)
  const w = WD[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]
  return m + '/' + dd + '(' + w + ')'
}
function dateText(r: any): string {
  if (!r.start_date) return ''
  let s = md(r.start_date)
  if (r.end_date && r.end_date !== r.start_date) s += '~' + md(r.end_date)
  else if (r.start_time && r.end_time) s += ' ' + r.start_time + '~' + r.end_time
  return s
}

async function deliver(targets: Array<PushSub & { sub_id: string }>, payloadFor: (t: any) => unknown) {
  const v = await vapid()
  if (!v) return { sent: 0, error: 'VAPID 키 없음' }
  const ok: string[] = [], gone: string[] = [], fail: string[] = []
  const log: Array<{ status: number }> = []
  for (const t of targets) {
    const r = await sendPush(t, payloadFor(t), v, { ttl: 86400, urgency: 'high' })
    log.push({ status: r.status })
    if (r.status >= 200 && r.status < 300) ok.push(t.sub_id)
    else if (r.status === 404 || r.status === 410) gone.push(t.sub_id)
    else { fail.push(t.sub_id); console.warn('push 실패', r.status, r.text) }
  }
  if (ok.length || gone.length || fail.length) {
    const m = await rpc('push_mark', { p_ok: ok, p_gone: gone, p_fail: fail })
    if (m.error) console.warn('push_mark 실패', m.error)
  }
  return { sent: ok.length, gone: gone.length, failed: fail.length, statuses: log.map((x) => x.status) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST 만 허용됩니다.' }, 405)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { return json({ error: '요청 형식이 올바르지 않습니다.' }, 400) }
  const action = String(body.action || '')

  const hook = req.headers.get('x-hook-token')
  if (hook) {
    const { data: ok, error } = await rpc('push_hook_ok', { p_token: hook })
    if (error || ok !== true) return json({ error: '인증에 실패했습니다.' }, 401)

    if (action === 'init') {
      const cur = await rpc('push_vapid_get', {})
      if (cur.data && cur.data.public) return json({ public: cur.data.public, created: false })
      const k = await generateVapidKeys()
      const r = await rpc('push_vapid_init', { p_public: k.publicKey, p_private: k.privateJwk })
      if (r.error) return json({ error: '키 저장 실패' }, 500)
      return json({ public: r.data, created: r.data === k.publicKey })
    }

    if (action === 'leave') {
      const id = String(body.request_id || '')
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'request_id 가 올바르지 않습니다.' }, 400)
      const { data, error: tErr } = await rpc('leave_push_targets', { p_request_id: id })
      if (tErr) return json({ error: '대상 조회 실패' }, 500)
      const rq = data && data.request
      const targets = (data && data.targets) || []
      if (!rq || !targets.length) return json({ sent: 0, targets: 0 })
      const cancel = rq.status === 'cancel_pending'
      const title = cancel ? '연차 취소 요청' : '연차 결재 요청'
      const text = [rq.name, rq.type, dateText(rq)].filter(Boolean).join(' · ')
      const res = await deliver(targets, (t: any) => ({
        title, body: text, tag: 'leave-' + id, badge: Number(t.badge) || 0,
        url: 'leave.html#' + (t.kind === 'team' ? 'team_approve' : 'admin_approve'),
      }))
      return json({ targets: targets.length, ...res })
    }
    return json({ error: '알 수 없는 action 입니다.' }, 400)
  }

  // 직원 본인 — 시험 알림
  if (action !== 'self_test') return json({ error: '인증이 필요합니다.' }, 401)
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return json({ error: '인증이 필요합니다.' }, 401)
  const ures = await fetch(URL_ + '/auth/v1/user', { headers: { apikey: ANON, Authorization: auth } })
  if (!ures.ok) return json({ error: '인증이 필요합니다.' }, 401)
  const au = await ures.json()
  if (!au || !au.id) return json({ error: '인증이 필요합니다.' }, 401)
  const { data: subs, error: sErr } = await rpc('push_self_targets', { p_auth_id: au.id })
  if (sErr) return json({ error: '대상 조회 실패' }, 500)
  if (!subs || !subs.length) return json({ sent: 0, targets: 0 })
  const res = await deliver(subs, () => ({
    title: '알림 시험', body: '이 기기로 연차 결재 알림이 옵니다.', tag: 'self-test', url: 'me.html',
  }))
  return json({ targets: subs.length, ...res })
})
