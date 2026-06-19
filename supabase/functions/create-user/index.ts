// Supabase Edge Function: create-user
// 직원 추가 시 Auth 계정 + users 테이블 row 동시 생성
// admin만 호출 가능
// v2: caller UID를 getUser()로 추출 후 service role로 auth_id 조회 (RLS 우회)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── JWT 토큰 확인 ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const jwt = authHeader.replace('Bearer ', '')

    // ── 클라이언트 준비 ───────────────────────────────────────
    // callerClient: caller 토큰으로 getUser()만 수행 (신원 추출용)
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    )
    // adminClient: service role (RLS 우회, caller 권한 조회 및 계정 생성용)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── caller 신원 확인 (getUser로 UID 추출) ─────────────────
    const { data: callerAuth, error: getUserErr } = await callerClient.auth.getUser()
    if (getUserErr || !callerAuth || !callerAuth.user) {
      return new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const callerUid = callerAuth.user.id

    // ── caller 권한 조회 (service role로 auth_id 기준, RLS 우회) ─
    const { data: callerData, error: callerErr } = await adminClient
      .from('users')
      .select('role')
      .eq('auth_id', callerUid)
      .single()

    if (callerErr || !callerData) {
      return new Response(
        JSON.stringify({ error: '사용자 정보를 확인할 수 없습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (callerData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: '관리자만 사용할 수 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 파라미터 ──────────────────────────────────────────────
    // name, phone(숫자만), role, team_id, join_date, total_days, init_pw
    // init_pw: 클라이언트에서 생성한 초기 비밀번호 (전화번호 또는 랜덤 6자리)
    const { name, phone, role, team_id, join_date, total_days, init_pw } = await req.json()

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: 'name, phone은 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authDomain = Deno.env.get('AUTH_DOMAIN') ?? 'kwanbo.internal'
    const email = phone + '@' + authDomain
    const password = init_pw || phone  // fallback: 전화번호

    // ── 중복 체크 ─────────────────────────────────────────────
    const { data: dupCheck } = await adminClient
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (dupCheck) {
      return new Response(
        JSON.stringify({ error: '이미 등록된 전화번호입니다.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Auth 계정 생성 ────────────────────────────────────────
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // 이메일 인증 없이 바로 활성화
    })

    if (authErr) {
      return new Response(
        JSON.stringify({ error: 'Auth 계정 생성 실패: ' + authErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── users 테이블 row 생성 ─────────────────────────────────
    const { data: userRow, error: dbErr } = await adminClient
      .from('users')
      .insert({
        name,
        phone,
        role:       role       || 'employee',
        team_id:    team_id    || null,
        join_date:  join_date  || null,
        total_days: total_days || 15,
        auth_id:    authData.user.id,
      })
      .select()
      .single()

    if (dbErr) {
      // users row 실패 시 Auth 계정도 롤백
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: 'DB 등록 실패: ' + dbErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, user: userRow, init_pw: password }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ error: '서버 오류: ' + (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
