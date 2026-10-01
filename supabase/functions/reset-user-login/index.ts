// Supabase Edge Function: reset-user-login
// [admin 전용] 직원 계정의 로그인 아이디·비밀번호를 임시값으로 초기화한다.
//   임시 아이디(tmp + 영숫자 5자) + 임시 비밀번호(8자) → 다음 로그인 때 아이디·비밀번호 모두 다시 정하게 한다
//   (must_change_id = must_change_pw = true).
//
// 권한: admin 만. 관리팀이 초기화할 수 있으면 그 직원 계정으로 로그인해 급여명세서를 볼 수 있어
//       "급여는 admin 전용" 원칙이 무너진다(CLAUDE.md 권한 원칙).
// 대체: 기존 update-user-phone / dynamic-action(아이디 변경)은 배포만 유지하고 화면에서는 이 함수를 쓴다.
//
// body: { user_id }  → { ok, login_id, init_pw }  (임시값은 이 응답에서 한 번만 돌려준다)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 혼동 문자 제외 — 구두·문자 전달 전제 (create-user / smooth-function 과 같은 규칙)
function genTempPw(len = 8): string {
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY34679'
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length]
  return out
}
// 임시 아이디: 영문 소문자로 시작(영문 1자 이상 규칙 충족), 혼동 문자(l·o·0·1) 제외
function genTempId(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const buf = new Uint32Array(5)
  crypto.getRandomValues(buf)
  let out = 'tmp'
  for (let i = 0; i < 5; i++) out += alphabet[buf[i] % alphabet.length]
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 입력 오류는 200 + { error } (functions.invoke 가 non-2xx 본문을 숨기므로), 인증 401 / 권한 403 / 서버 500
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: '인증이 필요합니다.' }, 401)

    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const callerClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 호출자: getUser 로 auth uid 를 얻고, service role 로 그 1행만 읽는다
    // (update-user-phone 은 필터 없이 .single() 을 해 항상 실패했다 — 같은 실수를 하지 않는다)
    const { data: ca, error: caErr } = await callerClient.auth.getUser()
    if (caErr || !ca?.user) return json({ error: '인증이 필요합니다.' }, 401)
    const { data: caller } = await admin.from('users').select('id, role').eq('auth_id', ca.user.id).maybeSingle()
    if (!caller) return json({ error: '사용자 정보를 확인할 수 없습니다.' }, 401)
    if (caller.role !== 'admin') return json({ error: '관리자만 초기화할 수 있습니다.' }, 403)

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.user_id ?? '')
    if (!userId) return json({ error: 'user_id 가 필요합니다.' })

    const { data: target } = await admin.from('users')
      .select('id, auth_id, role, username, must_change_id, must_change_pw').eq('id', userId).maybeSingle()
    if (!target) return json({ error: '직원을 찾을 수 없습니다.' })
    if (!target.auth_id) return json({ error: '로그인 계정이 없는 직원입니다.' })
    if (target.role === 'admin') return json({ error: '관리자 계정은 이 화면에서 초기화하지 않습니다.' })

    const authDomain = Deno.env.get('AUTH_DOMAIN') ?? 'kwanbo.internal'
    const initPw = genTempPw()

    // 임시 아이디 충돌 시(아이디·인증 이메일 중복) 새로 뽑아 최대 5번 시도
    for (let attempt = 0; attempt < 5; attempt++) {
      const tmpId = genTempId()

      const { error: upErr } = await admin.from('users')
        .update({ username: tmpId, must_change_id: true, must_change_pw: true }).eq('id', target.id)
      if (upErr) {
        if (upErr.code === '23505') continue
        return json({ error: '저장하지 못했습니다: ' + upErr.message }, 500)
      }

      const { error: authErr } = await admin.auth.admin.updateUserById(target.auth_id, {
        email: tmpId + '@' + authDomain, email_confirm: true, password: initPw,
      })
      if (!authErr) return json({ ok: true, login_id: tmpId, init_pw: initPw })

      // 인증 계정 변경 실패 → users 원복
      await admin.from('users').update({
        username: target.username, must_change_id: target.must_change_id, must_change_pw: target.must_change_pw,
      }).eq('id', target.id)
      if (!/already|exists|registered/i.test(authErr.message || '')) {
        return json({ error: '초기화하지 못했습니다: ' + authErr.message }, 500)
      }
    }
    return json({ error: '임시 아이디를 만들지 못했습니다. 다시 시도해 주세요.' }, 500)

  } catch (e) {
    return json({ error: '서버 오류: ' + (e as Error).message }, 500)
  }
})
