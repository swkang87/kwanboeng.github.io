// Supabase Edge Function: smooth-function (reset-user-password)
// 직원 비밀번호 초기화
// admin만 호출 가능
// v3: callerClient.auth.getUser()로 uid 추출 후 users 조회
// v4 (H-2): 전화번호로 초기화하던 것을 랜덤 임시 비밀번호로 교체.
//           동시에 users.must_change_pw = true 로 세워 첫 로그인 시 강제 변경을 유도한다.
//           초기 비밀번호는 응답(init_pw)으로 돌려준다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 혼동 문자 제외(B/8, I/1, O/0, S/5, Z/2)
function genTempPw(len = 8): string {
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY34679'
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length]
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    )

    const { data: { user: callerUser }, error: userAuthErr } = await callerClient.auth.getUser()
    if (userAuthErr || !callerUser) {
      return json({ error: '인증 정보를 확인할 수 없습니다.' }, 401)
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: callerData, error: callerErr } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', callerUser.id)
      .single()

    if (callerErr || !callerData) {
      return json({ error: '사용자 정보를 확인할 수 없습니다.' }, 401)
    }
    if (callerData.role !== 'admin') {
      return json({ error: '관리자만 사용할 수 있습니다.' }, 403)
    }

    const { user_id } = await req.json()
    if (!user_id) {
      return json({ error: 'user_id는 필수입니다.' }, 400)
    }

    const { data: userRow, error: userErr } = await adminClient
      .from('users')
      .select('id, auth_id, phone, name')
      .eq('id', user_id)
      .single()

    if (userErr || !userRow) {
      return json({ error: '직원을 찾을 수 없습니다.' }, 404)
    }
    if (!userRow.auth_id) {
      return json({ error: 'Auth 계정이 없습니다.' }, 404)
    }

    // H-2: 전화번호가 아니라 랜덤 임시 비밀번호를 만든다.
    // 전화번호가 비어 있어도 초기화가 가능해졌다.
    const initPw = genTempPw()

    const { error: pwErr } = await adminClient.auth.admin.updateUserById(
      userRow.auth_id, { password: initPw }
    )
    if (pwErr) {
      return json({ error: '비밀번호 초기화 실패: ' + pwErr.message }, 500)
    }

    // 첫 로그인 시 강제 변경. 실패해도 비밀번호는 이미 바뀌었으므로
    // 성공으로 응답하고 flag_set=false 로 구분해 돌려준다.
    let flagSet = true
    const { error: flagErr } = await adminClient
      .from('users')
      .update({ must_change_pw: true })
      .eq('id', userRow.id)
    if (flagErr) flagSet = false

    return json({ ok: true, name: userRow.name, init_pw: initPw, flag_set: flagSet })

  } catch (e) {
    return json({ error: '서버 오류: ' + (e as Error).message }, 500)
  }
})
