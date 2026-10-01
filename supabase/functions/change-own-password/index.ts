// Supabase Edge Function: change-own-password
// 본인 비밀번호·로그인 아이디 변경 (+ must_change_pw / must_change_id 플래그 해제)
//
// H-2 대응. 변경과 플래그 해제를 서버에서 한 경로로 묶는다.
// 클라이언트가 Auth 만 바꾸고 플래그는 그대로 두거나, 반대로 바꾸지 않고 플래그만 내리는 것을 구조적으로 막는다.
//
// v5 (2026-10-01): 새 로그인 아이디(new_login_id) 지원 — 인증 계정 이메일과 users.username 을 함께 바꾼다.
//   아이디 규칙·비밀번호 최소 길이는 auth_policy(직원관리 화면이 config.js AUTH_POLICY 를 복사해 둔 표)를 따르고,
//   표가 없으면 아래 DEFAULT_POLICY(엄격)로 동작한다. 비밀번호는 어떤 경우에도 8자 미만을 허용하지 않는다.
//   현재 비밀번호 확인은 실제 인증 계정 이메일로 한다(아이디를 바꾼 뒤에도 정확하도록).
//
// 호출: 로그인한 본인. 대상은 항상 caller 자신이며 user_id 파라미터를 받지 않는다.
// body: { current_pw, new_pw?, new_login_id? }
//   · must_change_id 이면 new_login_id 필수, must_change_pw 이면 new_pw 필수.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PW_FLOOR = 8
type Policy = { min: number; max: number; requireLetter: boolean; reserved: string[]; pwMin: number }
const DEFAULT_POLICY: Policy = {
  min: 4, max: 20, requireLetter: true,
  reserved: ['admin', 'root', 'test', 'manager', 'payroll'],
  pwMin: PW_FLOOR,
}

// deno-lint-ignore no-explicit-any
async function loadPolicy(admin: any): Promise<Policy> {
  const { data } = await admin.from('auth_policy').select('*').eq('id', 1).maybeSingle()
  if (!data) return DEFAULT_POLICY
  return {
    min: data.login_id_min, max: data.login_id_max,
    requireLetter: !!data.login_id_require_letter,
    reserved: (data.login_id_reserved || []).map((x: string) => String(x).toLowerCase()),
    pwMin: Math.max(PW_FLOOR, Number(data.password_min_length) || PW_FLOOR),
  }
}

function birthKeys(birth: string | null): string[] {
  if (!birth) return []
  const d = String(birth).replace(/\D/g, '')   // YYYYMMDD
  return d.length === 8 ? [d, d.slice(2)] : []
}

// 화면(sysbar.js checkLoginId / index.html)과 같은 규칙·같은 문구
function checkLoginId(id: string, p: Policy, phoneDigits: string, birth: string | null): string | null {
  if (id.length < p.min || id.length > p.max) return '아이디는 ' + p.min + '~' + p.max + '자로 정해 주세요.'
  if (!/^[a-z0-9]+$/.test(id)) return '아이디는 영문 소문자와 숫자만 쓸 수 있습니다.'
  if (p.requireLetter && !/[a-z]/.test(id)) return '아이디에 영문을 1자 이상 넣어 주세요.'
  if (p.reserved.includes(id)) return '사용할 수 없는 아이디입니다.'
  if (phoneDigits && id === phoneDigits) return '휴대폰 번호는 아이디로 쓸 수 없습니다.'
  if (birthKeys(birth).includes(id)) return '생년월일은 아이디로 쓸 수 없습니다.'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 사용자 입력 오류는 HTTP 200 + { error } 로 돌려준다.
  // supabase-js v2 의 functions.invoke 는 non-2xx 를 FunctionsHttpError 로 감싸며
  // 본문을 data 로 넘기지 않아, 화면에 "non-2xx status code" 만 뜨게 된다.
  // 인증 실패(401), 서버 오류(500)만 상태코드로 구분한다.
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: '인증이 필요합니다.' }, 401)
    }
    const jwt = authHeader.replace('Bearer ', '')

    const url     = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const adminClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // caller 신원 확인
    const { data: callerAuth, error: getUserErr } = await callerClient.auth.getUser()
    if (getUserErr || !callerAuth?.user) {
      return json({ error: '인증 정보를 확인할 수 없습니다.' }, 401)
    }
    const callerUid = callerAuth.user.id

    // 본인 users 행 조회 (service role, RLS 우회)
    const { data: me, error: meErr } = await adminClient
      .from('users')
      .select('id, auth_id, phone, username, birth_date, must_change_pw, must_change_id')
      .eq('auth_id', callerUid)
      .single()
    if (meErr || !me) {
      return json({ error: '사용자 정보를 확인할 수 없습니다.' }, 401)
    }
    if (!me.auth_id) {
      return json({ error: 'Auth 계정이 없습니다. 관리자에게 문의하세요.' }, 404)
    }

    const body = await req.json().catch(() => ({}))
    const currentPw = String(body?.current_pw ?? '')
    const newPw     = String(body?.new_pw ?? '')
    const newId     = String(body?.new_login_id ?? '').trim().toLowerCase()

    if (!currentPw) return json({ error: '현재 비밀번호를 입력하세요.' })
    if (!newPw && !newId) return json({ error: '바꿀 아이디 또는 비밀번호를 입력하세요.' })
    if (me.must_change_id && !newId) return json({ error: '새 아이디도 함께 정해야 합니다.' })
    if (me.must_change_pw && !newPw) return json({ error: '새 비밀번호도 함께 정해야 합니다.' })

    const policy = await loadPolicy(adminClient)
    const authDomain = Deno.env.get('AUTH_DOMAIN') ?? 'kwanbo.internal'
    const phoneDigits = String(me.phone || '').replace(/\D/g, '')

    // 현재 인증 계정 이메일 (아이디 변경 전후 모두 정확한 값)
    const { data: au, error: auErr } = await adminClient.auth.admin.getUserById(me.auth_id)
    if (auErr || !au?.user?.email) {
      return json({ error: '인증 계정을 확인할 수 없습니다. 관리자에게 문의하세요.' }, 500)
    }
    const oldEmail = au.user.email
    const oldLocal = oldEmail.split('@')[0].toLowerCase()

    // ── 새 아이디 검사 ─────────────────────────────────────
    if (newId) {
      const idErr = checkLoginId(newId, policy, phoneDigits, me.birth_date)
      if (idErr) return json({ error: idErr })
      if (newId === oldLocal) return json({ error: '지금 아이디와 다른 값을 입력하세요.' })
      const { data: dup } = await adminClient.from('users').select('id')
        .ilike('username', newId).neq('id', me.id).limit(1)
      if (dup && dup.length) return json({ error: '이미 사용 중인 아이디입니다.' })
    }

    // ── 새 비밀번호 검사 ───────────────────────────────────
    if (newPw) {
      if (newPw.length < policy.pwMin) {
        return json({ error: '새 비밀번호는 ' + policy.pwMin + '자 이상이어야 합니다.' })
      }
      if (newPw === currentPw) {
        return json({ error: '현재 비밀번호와 다른 값을 입력하세요.' })
      }
      // H-2 핵심: 전화번호·아이디를 비밀번호로 쓰는 것을 막는다.
      const newDigits = newPw.replace(/\D/g, '')
      if (phoneDigits && (newPw === phoneDigits || newDigits === phoneDigits)) {
        return json({ error: '휴대폰 번호를 비밀번호로 사용할 수 없습니다.' })
      }
      const loginNow = (newId || oldLocal)
      if (newPw.toLowerCase() === loginNow || newPw.toLowerCase() === oldLocal) {
        return json({ error: '아이디를 비밀번호로 사용할 수 없습니다.' })
      }
    }

    // ── 현재 비밀번호 재확인 ───────────────────────────────
    // JWT 만으로도 신원은 확인되지만, 세션 탈취 상황에서 계정 정보가 바뀌는 것을 막는다.
    const verifyClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: verifyErr } = await verifyClient.auth.signInWithPassword({
      email: oldEmail, password: currentPw,
    })
    if (verifyErr) {
      return json({ error: '현재 비밀번호가 올바르지 않습니다.' })
    }

    // ── 저장: users 먼저(중복은 고유 인덱스가 최종 차단) → 인증 계정. 인증 실패 시 users 원복 ──
    const usersPatch: Record<string, unknown> = {}
    if (newId) { usersPatch.username = newId; usersPatch.must_change_id = false }
    if (newPw) { usersPatch.must_change_pw = false }
    const { error: upErr } = await adminClient.from('users').update(usersPatch).eq('id', me.id)
    if (upErr) {
      if (upErr.code === '23505') return json({ error: '이미 사용 중인 아이디입니다.' })
      return json({ error: '저장하지 못했습니다: ' + upErr.message }, 500)
    }

    const authPatch: Record<string, unknown> = {}
    if (newId) { authPatch.email = newId + '@' + authDomain; authPatch.email_confirm = true }
    if (newPw) { authPatch.password = newPw }
    const { error: authErr } = await adminClient.auth.admin.updateUserById(me.auth_id, authPatch)
    if (authErr) {
      await adminClient.from('users').update({
        username: me.username, must_change_id: me.must_change_id, must_change_pw: me.must_change_pw,
      }).eq('id', me.id)
      const dupMsg = /already|exists|registered/i.test(authErr.message || '')
      return json({ error: dupMsg ? '이미 사용 중인 아이디입니다.' : '변경하지 못했습니다: ' + authErr.message },
                  dupMsg ? 200 : 500)
    }

    return json({ ok: true, login_id: newId || null, flag_cleared: true })

  } catch (e) {
    return json({ error: '서버 오류: ' + (e as Error).message }, 500)
  }
})
