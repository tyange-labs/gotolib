/**
 * 계정(tyange-cms-api): 패스키만 쓴다. 가입도 로그인도 패스키 하나로 하고 이메일·비밀번호는 없다.
 * 같은 출처의 `/api/cms/*`로 부른다(nginx·Vite 프록시). 토큰은 서버가 쓰는 대로 Bearer 없이
 * `Authorization` 헤더에 그대로 넣는다.
 *
 * 토큰은 localStorage에 둔다(유효기간 1년, 서버에 refresh 없음). XSS가 나면 읽힐 수 있지만
 * 이 토큰으로 할 수 있는 건 본인의 동기화 문서(책 목록)뿐이다.
 */
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { createSignal } from 'solid-js'

const API = '/api/cms'
const STORAGE_KEY = 'gotolib.session'

export interface Session {
  token: string
  userId: string
  role: string
  /** 이 로그인에 쓴 패스키의 id(브라우저가 알려준 값, 서버 목록의 id와 같다). 목록에서 '지금 사용 중'을 표시한다. */
  credentialId?: string
}

export interface PasskeyInfo {
  id: string
  label: string
  created_at: string | null
  last_used_at: string | null
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

const [session, setSession] = createSignal<Session | null>(load())
export { session }

function save(next: Session | null) {
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 저장이 막힌 환경(사생활 보호 모드 등)에서도 이번 세션은 메모리로 동작한다.
  }
  setSession(next)
}

export const logout = () => save(null)

/** JWT payload의 sub(사용자 id). 검증은 서버가 하고, 여기선 화면 표시용으로만 읽는다. */
function subjectOf(token: string): string {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return (JSON.parse(json) as { sub?: string }).sub ?? ''
  } catch {
    return ''
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.json !== undefined) headers.set('content-type', 'application/json')
  if (init.auth !== false) {
    const current = session()
    if (current) headers.set('authorization', current.token)
  }
  let res: Response
  try {
    res = await fetch(API + path, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    })
  } catch {
    throw new AuthError('서버에 연결하지 못했습니다.')
  }
  if (!res.ok) {
    if (res.status === 401 && init.auth !== false) logout()
    const text = await res.text().catch(() => '')
    throw new AuthError(messageFor(res.status, text), res.status)
  }
  return (await res.json()) as T
}

function messageFor(status: number, body: string): string {
  if (status === 401) return '로그인 정보가 맞지 않습니다.'
  if (status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도하세요.'
  // 503은 두 가지다: 패스키 설정이 꺼진 서버, 계정 상한에 닿은 서버. 서버가 보낸 문구를 우선한다.
  if (status === 503) return body.trim().slice(0, 120) || '지금은 이 기능을 쓸 수 없습니다.'
  return body.trim().slice(0, 120) || `요청에 실패했습니다 (${status})`
}

interface LoginResponse {
  access_token: string
  user_role: string
}

function adopt(response: LoginResponse, credentialId?: string) {
  save({
    token: response.access_token,
    userId: subjectOf(response.access_token),
    role: response.user_role,
    credentialId,
  })
}

/** 가입: 이 기기에서 패스키를 만들면서 계정이 생긴다. 이메일·비밀번호는 없다. */
export async function signUpWithPasskey(label: string) {
  const start = await api<{
    challenge_id: string
    options: { publicKey: PublicKeyCredentialCreationOptionsJSON }
  }>('/passkeys/signup/start', { method: 'POST', auth: false })

  let credential
  try {
    credential = await startRegistration({ optionsJSON: start.options.publicKey })
  } catch (e) {
    throw new AuthError(webauthnMessage(e))
  }

  const response = await api<LoginResponse>('/passkeys/signup/finish', {
    method: 'POST',
    json: { challenge_id: start.challenge_id, label, credential },
    auth: false,
  })
  adopt(response, credential.id)
}

/** 사용자명 없이: 브라우저가 이 사이트의 패스키를 골라준다. */
export async function loginWithPasskey() {
  const start = await api<{
    challenge_id: string
    options: { publicKey: PublicKeyCredentialRequestOptionsJSON }
  }>('/passkeys/login/start', { method: 'POST', auth: false })

  let credential
  try {
    credential = await startAuthentication({
      optionsJSON: start.options.publicKey,
    })
  } catch (e) {
    throw new AuthError(webauthnMessage(e))
  }

  const response = await api<LoginResponse>('/passkeys/login/finish', {
    method: 'POST',
    json: { challenge_id: start.challenge_id, credential },
    auth: false,
  })
  adopt(response, credential.id)
}

/** 로그인한 상태에서 이 기기에 패스키를 등록한다. */
export async function registerPasskey(label: string) {
  const start = await api<{
    challenge_id: string
    options: { publicKey: PublicKeyCredentialCreationOptionsJSON }
  }>('/passkeys/register/start', { method: 'POST' })

  let credential
  try {
    credential = await startRegistration({ optionsJSON: start.options.publicKey })
  } catch (e) {
    throw new AuthError(webauthnMessage(e))
  }

  await api('/passkeys/register/finish', {
    method: 'POST',
    json: { challenge_id: start.challenge_id, label, credential },
  })
}

export const listPasskeys = () => api<PasskeyInfo[]>('/passkeys')

export const deletePasskey = (id: string) =>
  api('/passkeys/' + encodeURIComponent(id), { method: 'DELETE' })

/** 브라우저가 던지는 오류를 사람이 읽을 말로. 사용자가 취소한 건 오류로 보이지 않게 한다. */
function webauthnMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : ''
  if (name === 'NotAllowedError' || name === 'AbortError') return '취소되었습니다.'
  if (name === 'InvalidStateError') return '이 기기에는 이미 등록된 패스키입니다.'
  if (name === 'NotSupportedError') return '이 브라우저는 패스키를 지원하지 않습니다.'
  return e instanceof Error ? e.message : '패스키 처리에 실패했습니다.'
}
