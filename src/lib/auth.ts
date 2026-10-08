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

/** 서버(tyange-cms-api)가 알려 준 경로(`/gotolib/...`)를 이 앱에서 부르는 주소로 바꾼다. */
export const apiUrl = (path: string) => API + path
const STORAGE_KEY = 'gotolib.session'

export interface Session {
  token: string
  userId: string
  role: string
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

/** 잠시 뒤 다시 하면 풀릴 수 있는 오류: 네트워크 단절, 프록시의 502·504(서버가 다시 뜨는 중 등) */
export function isTransient(e: unknown): boolean {
  return (
    e instanceof AuthError &&
    (e.status === 0 || e.status === 502 || e.status === 504)
  )
}

function messageFor(status: number, body: string): string {
  // nginx 등이 HTML 오류 페이지(502 Bad Gateway…)를 돌려주면 그 본문을 사용자에게 그대로 보이지 않는다.
  // 서버가 다시 뜨는 몇십 초 동안 화면에 태그 덩어리가 나오던 문제.
  if (/^\s*<(?:!doctype|html)/i.test(body) || status === 502 || status === 504) {
    return '서버가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.'
  }
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

function adopt(response: LoginResponse) {
  save({
    token: response.access_token,
    userId: subjectOf(response.access_token),
    role: response.user_role,
  })
}

/** 가입: 패스키를 만들면서 계정이 생긴다. 이메일·비밀번호는 없다. */
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
  adopt(response)
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

  let response: LoginResponse
  try {
    response = await api<LoginResponse>('/passkeys/login/finish', {
      method: 'POST',
      json: { challenge_id: start.challenge_id, credential },
      auth: false,
    })
  } catch (e) {
    // 401은 서버가 이 패스키를 모른다는 뜻이다: 계정 화면에서 지웠거나 다른 계정의 것. 이 기기(브라우저·키체인)에는
    // 패스키가 남아 있어서 로그인 창에는 계속 나온다.
    if (e instanceof AuthError && e.status === 401) {
      throw new AuthError(
        '이 패스키는 서버에 등록돼 있지 않아요(삭제했거나 다른 계정의 패스키예요). 로그인 창에서 다른 패스키를 고르거나 \'다른 기기의 패스키 사용\'을 선택하세요. 1Password 같은 비밀번호 관리자에 남은 옛 패스키는 거기서 지울 수 있어요.',
        401,
      )
    }
    throw e
  }
  adopt(response)
}

/** 로그인한 상태에서 패스키를 하나 더 등록한다. */
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
/** 사용자가 직접 닫은 경우(AbortError): 화면에 오류로 띄우지 않는다. */
export const CANCELLED = '취소되었습니다.'

function webauthnMessage(e: unknown): string {
  // 폰에서 '눌러도 아무 일도 없다'가 되지 않도록 원인을 남긴다(개발자 도구가 없는 환경 대비).
  console.error('[passkey]', e)
  const name = e instanceof Error ? e.name : ''
  if (name === 'AbortError') return CANCELLED
  // 브라우저는 '사용자가 취소'와 '막혀서 못 함'을 모두 NotAllowedError로 알려 주어 둘을 구분할 수 없다.
  // 예전에는 이걸 '취소'로 보고 아무 메시지도 안 띄워서, 막힌 경우에도 사용자에게는 무반응으로 보였다.
  if (name === 'NotAllowedError') {
    return '패스키 인증이 끝나지 않았어요. 창을 닫았거나, 시크릿 모드 같은 브라우저 설정 때문에 막혔을 수 있어요. (NotAllowedError)'
  }
  if (name === 'InvalidStateError') return '이 계정의 패스키가 이미 있어요(1Password 같은 비밀번호 관리자에 저장돼 있을 수 있어요).'
  if (name === 'NotSupportedError') return '이 브라우저는 패스키를 지원하지 않습니다.'
  const detail = e instanceof Error ? e.message : ''
  return `패스키 처리에 실패했어요${name ? ` (${name}${detail ? `: ${detail}` : ''})` : ''}`
}
