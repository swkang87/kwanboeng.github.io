// Supabase Edge Function: update-user-phone
// 직원 로그인 아이디(username) 변경
// - users.username 업데이트
// - Supabase Auth email도 함께 업데이트 (service_role 권한 필요)
// - new_username이 null이면 전화번호로 초기화

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-user-role',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // admin만 허용
    const callerRole = req.headers.get('x-user-role') || ''
    if (callerRole !== 'admin') {
      return new Response(
        JSON.stringify({ error: '관리자만 사용할 수 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { user_id, new_username } = await req.json()
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. users 테이블에서 auth_id, phone 조회
    const { data: userRow, error: userErr } = await adminClient
      .from('users')
      .select('id, auth_id, phone, username')
      .eq('id', user_id)
      .single()

    if (userErr || !userRow) {
      return new Response(
        JSON.stringify({ error: '직원을 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Auth email 결정
    // new_username이 null/빈칸이면 → 전화번호로 초기화
    let emailLocal: string
    if (!new_username) {
      // 초기화: phone 사용
      const phoneDigits = String(userRow.phone || '').replace(/\D/g, '')
      emailLocal = phoneDigits.length > 0 ? phoneDigits : String(userRow.phone || '')
    } else {
      // username 설정: 숫자만이면 digits, 아니면 그대로
      const digits = String(new_username).replace(/\D/g, '')
      emailLocal = digits.length > 0 ? digits : String(new_username)
    }
    const newEmail = emailLocal + '@kwanbo.internal'

    // 3. 중복 아이디 체크 (username 기준, 비어있으면 스킵)
    if (new_username) {
      const { data: dupCheck } = await adminClient
        .from('users')
        .select('id')
        .eq('username', new_username)
        .neq('id', user_id)
        .single()
      if (dupCheck) {
        return new Response(
          JSON.stringify({ error: '이미 사용 중인 아이디입니다.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 4. Supabase Auth email 업데이트
    if (userRow.auth_id) {
      const { error: authErr } = await adminClient.auth.admin.updateUserById(
        userRow.auth_id,
        { email: newEmail }
      )
      if (authErr) {
        return new Response(
          JSON.stringify({ error: 'Auth 업데이트 실패: ' + authErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 5. users.username 업데이트 (null이면 초기화)
    const { error: dbErr } = await adminClient
      .from('users')
      .update({ username: new_username || null })
      .eq('id', user_id)

    if (dbErr) {
      return new Response(
        JSON.stringify({ error: 'DB 업데이트 실패: ' + dbErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, username: new_username || null, auth_email: newEmail }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ error: '서버 오류: ' + (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
