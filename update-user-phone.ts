// Supabase Edge Function: update-user-phone
// 직원 로그인 아이디(전화번호) 변경
// - users.phone 업데이트
// - Supabase Auth email 업데이트 (service_role 권한 필요)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-user-role',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 요청자 권한 확인 (admin만 허용)
    const callerRole = req.headers.get('x-user-role') || ''
    if (callerRole !== 'admin') {
      return new Response(
        JSON.stringify({ error: '관리자만 사용할 수 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { user_id, new_phone } = await req.json()

    if (!user_id || !new_phone) {
      return new Response(
        JSON.stringify({ error: 'user_id와 new_phone은 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 전화번호 → Auth email 변환
    const phoneDigits = String(new_phone).replace(/\D/g, '')
    const emailLocal  = phoneDigits.length > 0 ? phoneDigits : new_phone
    const newEmail    = emailLocal + '@kwanbo.internal'

    // service_role 클라이언트 (Auth 조작용)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. users 테이블에서 auth_id 조회
    const { data: userRow, error: userErr } = await adminClient
      .from('users')
      .select('id, auth_id, phone')
      .eq('id', user_id)
      .single()

    if (userErr || !userRow) {
      return new Response(
        JSON.stringify({ error: '직원을 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. 중복 전화번호 체크
    const { data: dupCheck } = await adminClient
      .from('users')
      .select('id')
      .eq('phone', new_phone)
      .neq('id', user_id)
      .single()

    if (dupCheck) {
      return new Response(
        JSON.stringify({ error: '이미 사용 중인 전화번호입니다.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Supabase Auth email 업데이트
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

    // 4. users.phone 업데이트
    const { error: dbErr } = await adminClient
      .from('users')
      .update({ phone: new_phone })
      .eq('id', user_id)

    if (dbErr) {
      return new Response(
        JSON.stringify({ error: 'DB 업데이트 실패: ' + dbErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, new_phone, new_email: newEmail }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ error: '서버 오류: ' + e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
