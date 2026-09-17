// Supabase Edge Function: change-own-password
// 본인 비밀번호 변경 (+ must_change_pw 플래그 해제)
//
// H-2 대응. 비밀번호 변경과 플래그 해제를 서버에서 한 경로로 묶는다.
// 클라이언트가 Auth 비밀번호만 바꾸고 플래그는 그대로 두거나,
// 반대로 비밀번호를 바꾸지 않고 플래그만 내리는 것을 구조적으로 막는다.
//
// 호출: 로그인한 본인. 대상은 항상 caller 자신이며 user_id 파라미터를 받지 않는다.
// body: { current_pw, new_pw }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// doLogin / ProfileView 와 동일한 규칙: username 우선, 숫자가 있으면 숫자만
function loginLocal(username: string | null, phone: string | null): string {
  const src = username && String(username).trim() ? String(username) : String(phone || '')
  const digits = src.replace(/\D/g, '')
  return digits.length > 0 ? digits : src
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
      .select('id, auth_id, phone, username, must_change_pw')
      .eq('auth_id', callerUid)
      .single()

    if (meErr || !me) {
      return json({ error: '사용자 정보를 확인할 수 없습니다.' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const currentPw = String(body?.current_pw ?? '')
    const newPw     = String(body?.new_pw ?? '')

    if (!currentPw || !newPw) {
      return json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력하세요.' })
    }

    // 새 비밀번호 검증. 길이는 기존 화면 안내(6자 이상)와 맞춘다.
    if (newPw.length < 6) {
      return json({ error: '새 비밀번호는 6자 이상이어야 합니다.' })
    }
    if (newPw === currentPw) {
      return json({ error: '현재 비밀번호와 다른 값을 입력하세요.' })
    }
    // H-2 핵심: 전화번호(= 로그인 ID)를 비밀번호로 되돌리는 것을 막는다.
    const phoneDigits = String(me.phone || '').replace(/\D/g, '')
    const unameDigits = String(me.username || '').replace(/\D/g, '')
    const newDigits   = newPw.replace(/\D/g, '')
    if (phoneDigits && (newPw === phoneDigits || newDigits === phoneDigits)) {
      return json({ error: '전화번호를 비밀번호로 사용할 수 없습니다.' })
    }
    if (unameDigits && (newPw === unameDigits || newDigits === unameDigits)) {
      return json({ error: '로그인 아이디를 비밀번호로 사용할 수 없습니다.' })
    }

    // 현재 비밀번호 재확인.
    // JWT 만으로도 신원은 확인되지만, 세션 탈취 상황에서 비밀번호가 바뀌는 것을 막는다.
    const authDomain = Deno.env.get('AUTH_DOMAIN') ?? 'kwanbo.internal'
    const email = loginLocal(me.username, me.phone) + '@' + authDomain

    const verifyClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: verifyErr } = await verifyClient.auth.signInWithPassword({
      email, password: currentPw,
    })
    if (verifyErr) {
      return json({ error: '현재 비밀번호가 올바르지 않습니다.' })
    }

    // 비밀번호 변경
    if (!me.auth_id) {
      return json({ error: 'Auth 계정이 없습니다. 관리자에게 문의하세요.' }, 404)
    }
    const { error: pwErr } = await adminClient.auth.admin.updateUserById(
      me.auth_id, { password: newPw }
    )
    if (pwErr) {
      return json({ error: '비밀번호 변경 실패: ' + pwErr.message }, 500)
    }

    // 플래그 해제. 비밀번호 변경이 성공한 뒤에만 내린다.
    // 실패해도 비밀번호는 이미 바뀌었으므로 사용자에게는 성공으로 알리고
    // flag_cleared=false 로 구분해 돌려준다.
    let flagCleared = true
    if (me.must_change_pw) {
      const { error: flagErr } = await adminClient
        .from('users')
        .update({ must_change_pw: false })
        .eq('id', me.id)
      if (flagErr) flagCleared = false
    }

    return json({ ok: true, flag_cleared: flagCleared })

  } catch (e) {
    return json({ error: '서버 오류: ' + (e as Error).message }, 500)
  }
})
