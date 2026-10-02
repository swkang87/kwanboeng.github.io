// Supabase Edge Function: payroll-mail
// 급여명세서 알림 메일 발송 (급여명세서 모듈 재구축 5단계)
//
// 메일에는 금액을 넣지 않는다. "명세서가 발행되었다" 안내 + 로그인 필요한 명세서 화면 링크만 보낸다.
//
// 호출자 인증 (verify_jwt = false — 아래에서 직접 확인한다)
//   · 예약 작업(pg_cron): x-cron-token 헤더 → DB 함수 payroll_mail_cron_ok 로 Vault 토큰과 대조. mode=auto 만 허용.
//   · 관리자 화면: Authorization: Bearer <로그인 JWT> → getUser() → users.role = 'admin' 만 허용.
//
// mode
//   · auto : (2026-10-02 기본 꺼짐 — payroll_mail_settings.auto_send = true 일 때만 동작, 예약 작업도 해제됨)
//            지급용 + 확정 + 지급일 = 오늘(KST) + 지급일 09:00 KST 이전에 확정된 묶음만,
//            이 묶음에서 아직 발송 성공 기록이 없는 대상자에게 보낸다(중복 발송 없음).
//            dry_run=true 이면 보내지 않고 대상 수만 돌려준다(today / assume_confirmed_at 은 dry_run 에서만 허용).
//   · send : [관리자] 확정된 지급용 묶음. 발송 성공 기록이 없는 대상자(미발송·실패자)에게 보낸다.
//            revised=true 이면 대신 "이전 확정본으로만 받은" 대상자에게 수정본 안내를 보낸다.
//   · test : [관리자] 대상자 정확히 1명에게만 [테스트] 메일. 작성중 묶음도 가능. 발송 로그를 남기지 않는다.
//
// 발신 설정은 payroll_mail_settings(급여 화면이 config.js 값을 복사해 둔 표)에서 읽는다 — 하드코딩 없음.
// 필요한 Secret: RESEND_API_KEY (+ Supabase 기본 SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const SEND_GAP_MS = 600   // Resend 기본 초당 2건 제한

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c])
}
function periodKo(p: string): string {
  return p.slice(0, 4) + '년 ' + parseInt(p.slice(5, 7), 10) + '월'
}
function dateKo(d: string | null): string {
  if (!d) return ''
  return d.slice(0, 4) + '년 ' + parseInt(d.slice(5, 7), 10) + '월 ' + parseInt(d.slice(8, 10), 10) + '일'
}
function maskEmail(e: string): string {
  const at = e.indexOf('@')
  if (at < 1) return '***'
  const local = e.slice(0, at)
  return local.slice(0, Math.min(2, local.length)) + '***' + e.slice(at)
}

// 지급일 09:00 KST = 지급일 00:00 UTC. 그 이전에 확정된 묶음만 자동 발송한다.
function confirmedBeforeSendTime(confirmedAt: string | null, payDate: string): boolean {
  if (!confirmedAt) return false
  return new Date(confirmedAt).getTime() < new Date(payDate + 'T00:00:00Z').getTime()
}

type Settings = { from_address: string; from_name: string; reply_to: string | null; site_url: string; slip_page: string; auto_send?: boolean }
type Run = { id: string; period: string; run_type: string; pay_date: string | null; status: string; confirmed_at: string | null; revision: number }
type Target = { employee_id: string; name: string; email: string }
type Log = { employee_id: string; status: string; revision: number; kind: string }

function buildMail(s: Settings, run: Run, t: Target, opt: { kind: 'initial' | 'revised'; test: boolean }) {
  const base = s.site_url.replace(/\/+$/, '')
  const link = base + '/' + s.slip_page.replace(/^\/+/, '') + '?period=' + encodeURIComponent(run.period)
  const pk = periodKo(run.period)
  const subject = (opt.test ? '[테스트] ' : '') + pk + ' 급여명세서 안내' + (opt.kind === 'revised' ? ' (수정)' : '')
  const lead = opt.kind === 'revised'
    ? pk + ' 급여명세서가 수정되어 다시 발행되었습니다. 이전 안내 대신 수정된 명세서를 확인해 주세요.'
    : pk + ' 급여명세서가 발행되었습니다.'
  const payLine = run.pay_date ? '지급일: ' + dateKo(run.pay_date) : ''
  const testNote = '이 메일은 발송 기능 점검용 테스트입니다. 실제 명세서 발행 안내가 아닙니다.'
  const replyNote = s.reply_to ? '문의는 이 메일에 회신해 주세요.' : ''

  const html =
    '<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;font-family:\'Malgun Gothic\',\'Apple SD Gothic Neo\',sans-serif;color:#0f172a;">' +
    (opt.test ? '<tr><td style="padding:12px 24px;background:#fef3c7;color:#92400e;font-size:13px;border-radius:8px 8px 0 0;">' + esc(testNote) + '</td></tr>' : '') +
    '<tr><td style="padding:24px 24px 8px;font-size:16px;font-weight:700;">' + esc(s.from_name) + '</td></tr>' +
    '<tr><td style="padding:8px 24px;font-size:14px;line-height:1.7;">' +
      esc(t.name) + '님, 안녕하세요.<br>' + esc(lead) +
      (payLine ? '<br><span style="color:#475569;">' + esc(payLine) + '</span>' : '') +
    '</td></tr>' +
    '<tr><td style="padding:16px 24px;">' +
      '<a href="' + esc(link) + '" style="display:inline-block;padding:11px 20px;background:#1b3a6b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">급여명세서 확인하기</a>' +
    '</td></tr>' +
    '<tr><td style="padding:8px 24px 24px;font-size:12px;line-height:1.7;color:#64748b;">' +
      '로그인한 본인만 명세서를 볼 수 있으며, 이 메일에는 금액이 들어 있지 않습니다.<br>' +
      '버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br>' +
      '<span style="word-break:break-all;">' + esc(link) + '</span>' +
      (replyNote ? '<br>' + esc(replyNote) : '') +
    '</td></tr>' +
    '</table></td></tr></table></body></html>'

  const text = [
    opt.test ? testNote : '',
    t.name + '님, 안녕하세요.',
    lead,
    payLine,
    '',
    '급여명세서 확인: ' + link,
    '',
    '로그인한 본인만 명세서를 볼 수 있으며, 이 메일에는 금액이 들어 있지 않습니다.',
    replyNote,
  ].filter((x, i) => x !== '' || i === 4 || i === 6).join('\n')

  return { subject, html, text }
}

async function sendResend(apiKey: string, s: Settings, to: string, mail: { subject: string; html: string; text: string }, idemKey: string | null) {
  const headers: Record<string, string> = { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
  if (idemKey) headers['Idempotency-Key'] = idemKey
  const body: Record<string, unknown> = {
    from: s.from_name + ' <' + s.from_address + '>',
    to: [to],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  }
  if (s.reply_to) body.reply_to = s.reply_to
  try {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, id: null, error: ('[' + res.status + '] ' + (data.message || data.name || res.statusText)).slice(0, 500) }
    return { ok: true, id: (data && data.id) || null, error: null }
  } catch (e) {
    return { ok: false, id: null, error: ('network: ' + ((e as Error).message || String(e))).slice(0, 500) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST 만 허용됩니다.' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { return json({ error: '요청 형식이 올바르지 않습니다.' }, 400) }
  const mode = String(body.mode || '')
  const dryRun = body.dry_run === true

  // ── 호출자 확인 ─────────────────────────────────────────
  let caller: 'cron' | 'admin' | null = null
  let callerUserId: string | null = null
  const cronToken = req.headers.get('x-cron-token')
  if (cronToken) {
    const { data: ok, error } = await admin.rpc('payroll_mail_cron_ok', { p_token: cronToken })
    if (error || ok !== true) return json({ error: '인증에 실패했습니다.' }, 401)
    caller = 'cron'
  } else {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return json({ error: '인증이 필요합니다.' }, 401)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: auth } } },
    )
    const { data: au, error: auErr } = await userClient.auth.getUser()
    if (auErr || !au || !au.user) return json({ error: '인증이 필요합니다.' }, 401)
    const { data: me } = await admin.from('users').select('id, role').eq('auth_id', au.user.id).maybeSingle()
    if (!me) return json({ error: '사용자 정보를 확인할 수 없습니다.' }, 401)
    if (me.role !== 'admin') return json({ error: '관리자만 사용할 수 있습니다.' }, 403)
    caller = 'admin'
    callerUserId = me.id
  }

  if (!['auto', 'send', 'test'].includes(mode)) return json({ error: '알 수 없는 mode 입니다.' }, 400)
  if (caller === 'cron' && mode !== 'auto') return json({ error: '예약 작업은 auto 만 호출할 수 있습니다.' }, 403)
  if (caller === 'admin' && mode === 'auto' && !dryRun) return json({ error: '자동 발송은 예약 작업만 실행합니다. (관리자는 dry_run 만 가능)' }, 403)

  // dry_run 전용 모의 값
  const today = (dryRun && typeof body.today === 'string' && DATE_RE.test(body.today)) ? body.today : kstToday()
  const assumeConfirmedAt = (dryRun && typeof body.assume_confirmed_at === 'string' && !isNaN(Date.parse(body.assume_confirmed_at)))
    ? new Date(body.assume_confirmed_at).toISOString() : null

  // ── 발신 설정 ───────────────────────────────────────────
  const { data: settings, error: setErr } = await admin.from('payroll_mail_settings').select('*').eq('id', 1).maybeSingle()
  if (setErr) return json({ error: '메일 설정 조회 실패: ' + setErr.message }, 500)
  // 설정은 실제로 보낼 때만 필요하다(dry_run 은 설정 없이도 대상 판정을 확인할 수 있다).
  const s = settings as Settings | null
  const noSettings = () => json({ error: '메일 설정이 없습니다. 관리자 급여 화면을 한 번 열어 설정을 동기화하세요.' }, 409)

  const apiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  if (!apiKey && !dryRun) return json({ error: 'RESEND_API_KEY 가 등록되어 있지 않습니다.' }, 500)

  // ── 공통: 묶음의 발송 대상 ─────────────────────────────
  async function loadTargets(runId: string): Promise<{ targets: Target[]; noEmail: string[] }> {
    const { data: slips, error } = await admin.from('payroll_slips').select('employee_id').eq('run_id', runId)
    if (error) throw new Error('명세서 조회 실패: ' + error.message)
    const ids = (slips || []).map((x) => x.employee_id)
    if (!ids.length) return { targets: [], noEmail: [] }
    const { data: emps, error: e2 } = await admin.from('payroll_employees').select('id, user_id, notify_email').in('id', ids)
    if (e2) throw new Error('대상자 조회 실패: ' + e2.message)
    const uids = (emps || []).map((e) => e.user_id).filter(Boolean)
    const { data: us, error: e3 } = uids.length
      ? await admin.from('users').select('id, name, role').in('id', uids)
      : { data: [], error: null }
    if (e3) throw new Error('사용자 조회 실패: ' + e3.message)
    const um: Record<string, { name: string; role: string }> = {}
    ;(us || []).forEach((u) => { um[u.id] = u })
    const targets: Target[] = []
    const noEmail: string[] = []
    ;(emps || []).forEach((e) => {
      const u = e.user_id ? um[e.user_id] : null
      if (!u || u.role === 'contractor') return            // 계정 없음·용역직은 명세서 화면을 볼 수 없어 대상 아님
      const email = String(e.notify_email || '').trim()
      if (!EMAIL_RE.test(email)) { noEmail.push(e.id); return }
      targets.push({ employee_id: e.id, name: u.name || '', email })
    })
    return { targets, noEmail }
  }
  async function loadLogs(runId: string): Promise<Log[]> {
    const { data, error } = await admin.from('payroll_mail_logs').select('employee_id, status, revision, kind').eq('run_id', runId)
    if (error) throw new Error('발송 이력 조회 실패: ' + error.message)
    return (data || []) as Log[]
  }

  async function deliver(run: Run, list: Target[], kind: 'initial' | 'revised', logs: Log[]) {
    const results: { employee_id: string; ok: boolean; error: string | null }[] = []
    for (let i = 0; i < list.length; i++) {
      const t = list[i]
      // 같은 사람·같은 확정본·같은 종류의 실패 횟수를 키에 넣는다:
      // 동시에 두 번 불려도(자동+수동) 키가 같아 Resend 가 1통만 보내고, 실패 후 재시도는 새 키로 나간다.
      const fails = logs.filter((l) => l.employee_id === t.employee_id && l.status === 'failed' && l.revision === run.revision && l.kind === kind).length
      const idem = ['payroll', run.id, t.employee_id, 'r' + run.revision, kind, 'a' + fails].join('-')
      const r = await sendResend(apiKey, s!, t.email, buildMail(s!, run, t, { kind, test: false }), idem)
      const { error: logErr } = await admin.from('payroll_mail_logs').insert({
        run_id: run.id, employee_id: t.employee_id, email: t.email, kind, revision: run.revision,
        status: r.ok ? 'sent' : 'failed', error: r.error, provider_message_id: r.id, sent_by: callerUserId,
      })
      results.push({ employee_id: t.employee_id, ok: r.ok, error: r.error || (logErr ? '로그 기록 실패: ' + logErr.message : null) })
      if (i < list.length - 1) await sleep(SEND_GAP_MS)
    }
    return results
  }

  try {
    // ── auto ──────────────────────────────────────────────
    // 2차 안전장치: 자동 발송이 꺼져 있으면(config.js PAYROLL.AUTO_SEND → payroll_mail_settings.auto_send)
    // 예약 작업이 남아 있거나 다시 불려도 아무것도 하지 않고 끝낸다. 설정 행이 없어도 끈 것으로 본다.
    if (mode === 'auto' && !(s && s.auto_send === true)) {
      return json({ ok: true, mode, dry_run: dryRun, today, auto_send: false, runs: [], note: '자동 발송이 꺼져 있습니다.' })
    }
    if (mode === 'auto') {
      const q = admin.from('payroll_runs').select('*').eq('run_type', 'pay').eq('pay_date', today)
      const { data: runs, error } = await (assumeConfirmedAt ? q : q.eq('status', 'confirmed'))
      if (error) throw new Error('묶음 조회 실패: ' + error.message)
      const out: unknown[] = []
      for (const raw of (runs || []) as Run[]) {
        const run = assumeConfirmedAt ? { ...raw, status: 'confirmed', confirmed_at: assumeConfirmedAt } : raw
        if (run.status !== 'confirmed') { out.push({ run_id: run.id, period: run.period, skipped: '확정 아님' }); continue }
        if (!confirmedBeforeSendTime(run.confirmed_at, run.pay_date as string)) {
          out.push({ run_id: run.id, period: run.period, skipped: '지급일 09시 이후 확정 — 수동 발송 대상' }); continue
        }
        const { targets, noEmail } = await loadTargets(run.id)
        const logs = await loadLogs(run.id)
        const sentSet = new Set(logs.filter((l) => l.status === 'sent').map((l) => l.employee_id))
        const todo = targets.filter((t) => !sentSet.has(t.employee_id))
        if (dryRun) {
          out.push({ run_id: run.id, period: run.period, would_send: todo.length, already_sent: targets.length - todo.length, no_email: noEmail.length })
          continue
        }
        if (!s) return noSettings()
        const res = await deliver(run, todo, 'initial', logs)
        out.push({ run_id: run.id, period: run.period, sent: res.filter((r) => r.ok).length, failed: res.filter((r) => !r.ok).length,
                   already_sent: targets.length - todo.length, no_email: noEmail.length })
      }
      return json({ ok: true, mode, dry_run: dryRun, today, runs: out })
    }

    // ── send / test: 묶음 확인 ─────────────────────────────
    const runId = String(body.run_id || '')
    if (!runId) return json({ error: 'run_id 가 필요합니다.' }, 400)
    const { data: runRow, error: rErr } = await admin.from('payroll_runs').select('*').eq('id', runId).maybeSingle()
    if (rErr) throw new Error('묶음 조회 실패: ' + rErr.message)
    if (!runRow) return json({ error: '급여 묶음을 찾을 수 없습니다.' }, 404)
    const run = runRow as Run
    if (run.run_type !== 'pay') return json({ error: '지급용 명세서만 알림 메일을 보냅니다.' }, 400)

    // ── test: 정확히 1명 ─────────────────────────────────
    if (mode === 'test') {
      if (Array.isArray(body.employee_id) || typeof body.employee_id !== 'string' || !body.employee_id) {
        return json({ error: '테스트 발송은 대상자 1명만 지정할 수 있습니다.' }, 400)
      }
      const { targets, noEmail } = await loadTargets(run.id)
      const t = targets.find((x) => x.employee_id === body.employee_id)
      if (!t) {
        return json({ error: noEmail.includes(body.employee_id as string)
          ? '이 대상자는 수신 이메일이 없거나 형식이 올바르지 않습니다.'
          : '이 묶음의 명세서 대상자가 아니거나, 계정이 연결되지 않은 대상자입니다.' }, 400)
      }
      if (dryRun) return json({ ok: true, mode, dry_run: true, email_masked: maskEmail(t.email) })
      if (!s) return noSettings()
      const r = await sendResend(apiKey, s!, t.email, buildMail(s!, run, t, { kind: run.revision > 1 ? 'revised' : 'initial', test: true }), null)
      if (!r.ok) return json({ ok: false, mode, email_masked: maskEmail(t.email), error: r.error }, 502)
      return json({ ok: true, mode, email_masked: maskEmail(t.email), provider_message_id: r.id })
    }

    // ── send ─────────────────────────────────────────────
    if (run.status !== 'confirmed') return json({ error: '확정된 명세서만 발송할 수 있습니다.' }, 409)
    const revised = body.revised === true
    const { targets, noEmail } = await loadTargets(run.id)
    const logs = await loadLogs(run.id)
    const sent = logs.filter((l) => l.status === 'sent')
    let todo: Target[]
    if (revised) {
      // 이전 확정본으로는 받았지만 현재 확정본(revision)으로는 받은 적 없는 사람
      todo = targets.filter((t) => {
        const mine = sent.filter((l) => l.employee_id === t.employee_id)
        return mine.length > 0 && !mine.some((l) => l.revision >= run.revision)
      })
    } else {
      const sentSet = new Set(sent.map((l) => l.employee_id))
      todo = targets.filter((t) => !sentSet.has(t.employee_id))
    }
    if (dryRun) return json({ ok: true, mode, dry_run: true, would_send: todo.length, no_email: noEmail.length })
    if (!todo.length) return json({ ok: true, mode, sent: 0, failed: 0, results: [], no_email: noEmail.length, note: '보낼 대상이 없습니다.' })
    if (!s) return noSettings()
    const res = await deliver(run, todo, revised ? 'revised' : 'initial', logs)
    return json({
      ok: true, mode, sent: res.filter((r) => r.ok).length, failed: res.filter((r) => !r.ok).length,
      results: res, no_email: noEmail.length,
    })
  } catch (e) {
    return json({ error: (e as Error).message || String(e) }, 500)
  }
})
