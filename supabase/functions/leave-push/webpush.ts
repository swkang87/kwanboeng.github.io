// 웹 푸시 보내기 — WebCrypto 만 쓴다(외부 라이브러리 없음). Deno(Edge Function)와 Node(시험) 둘 다에서 돈다.
//   암호화 = RFC 8291 (Message Encryption for Web Push) + RFC 8188 aes128gcm, 보낸 사람 확인 = RFC 8292 VAPID(ES256 JWT).
//   회사 값 없음.

const enc = new TextEncoder()

export function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function b64uDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const raw = atob(s)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
function concat(...parts: Uint8Array[]): Uint8Array {
  let n = 0
  for (const p of parts) n += p.length
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8)
  return new Uint8Array(bits)
}

// VAPID 키 한 쌍 만들기 — 공개키(raw 65바이트, base64url) + 비밀키(JWK 문자열)
export async function generateVapidKeys(): Promise<{ publicKey: string; privateJwk: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const pub = await crypto.subtle.exportKey('raw', kp.publicKey)
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  return { publicKey: b64uEncode(pub), privateJwk: JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }) }
}

// 내용 암호화(aes128gcm). 기록 하나(4096 바이트 안), 채움 없음.
export async function encryptPayload(payload: Uint8Array, uaPublicB64u: string, authSecretB64u: string,
  testing?: { asKeyPair?: CryptoKeyPair; salt?: Uint8Array }): Promise<Uint8Array> {
  const uaPublic = b64uDecode(uaPublicB64u)
  const authSecret = b64uDecode(authSecretB64u)
  const asKP = testing?.asKeyPair ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKP.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKP.privateKey, 256))
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32)
  const salt = testing?.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const plain = concat(payload, new Uint8Array([2]))               // 마지막 기록 구분자
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain))
  const rs = 4096
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, rs)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, cipher)
}

// VAPID 서명(JWT ES256). aud = 받는 푸시 서비스의 origin
export async function vapidAuth(endpoint: string, publicKey: string, privateJwk: string, subject: string): Promise<string> {
  const aud = new URL(endpoint).origin
  const jwk = JSON.parse(privateJwk)
  const key = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const head = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64uEncode(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })))
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body))
  return 'vapid t=' + head + '.' + body + '.' + b64uEncode(sig) + ', k=' + publicKey
}

export interface PushSub { endpoint: string; p256dh: string; auth: string }

// 한 구독에 보내기 → HTTP 상태(네트워크 오류 = 0)
export async function sendPush(sub: PushSub, data: unknown, vapid: { publicKey: string; privateJwk: string; subject: string },
  opts: { ttl?: number; urgency?: string; topic?: string } = {}): Promise<{ status: number; text: string }> {
  try {
    const body = await encryptPayload(enc.encode(JSON.stringify(data)), sub.p256dh, sub.auth)
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': String(opts.ttl ?? 86400),
      'Urgency': opts.urgency ?? 'high',
      'Authorization': await vapidAuth(sub.endpoint, vapid.publicKey, vapid.privateJwk, vapid.subject),
    }
    if (opts.topic) headers['Topic'] = opts.topic
    const res = await fetch(sub.endpoint, { method: 'POST', headers, body })
    const text = (await res.text()).slice(0, 300)
    return { status: res.status, text }
  } catch (e) {
    return { status: 0, text: String((e as Error)?.message || e).slice(0, 300) }
  }
}
