import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { bytesEqual, describeSupport, urlBase64ToUint8Array } from '../src/lib/pushSupport'

const all = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIos: false, isStandalone: false }

describe('describeSupport', () => {
  test('데스크톱·안드로이드: 세 기능이 다 있으면 지원', () => {
    expect(describeSupport(all)).toBe('supported')
  })
  test('하나라도 없으면 지원 안 함', () => {
    expect(describeSupport({ ...all, hasPushManager: false })).toBe('unsupported')
    expect(describeSupport({ ...all, hasServiceWorker: false })).toBe('unsupported')
    expect(describeSupport({ ...all, hasNotification: false })).toBe('unsupported')
  })
  test('iOS Safari 탭: PushManager가 없어도 "지원 안 함"이 아니라 홈 화면 추가 안내', () => {
    expect(describeSupport({ ...all, isIos: true, hasPushManager: false })).toBe('needs-install')
    expect(describeSupport({ ...all, isIos: true })).toBe('needs-install')
  })
  test('iOS 홈 화면 앱(standalone): 세 기능이 있으면 지원', () => {
    expect(describeSupport({ ...all, isIos: true, isStandalone: true })).toBe('supported')
    expect(describeSupport({ ...all, isIos: true, isStandalone: true, hasPushManager: false })).toBe('unsupported')
  })
})

describe('urlBase64ToUint8Array', () => {
  test('서버 공개 키 형태(65바이트, 04로 시작)를 그대로 되돌린다', () => {
    const raw = new Uint8Array(65)
    raw[0] = 4
    for (let i = 1; i < 65; i++) raw[i] = (i * 7) % 256
    const b64url = btoa(String.fromCharCode(...raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(b64url).not.toContain('=')
    const back = urlBase64ToUint8Array(b64url)
    expect(back.length).toBe(65)
    expect(Array.from(back)).toEqual(Array.from(raw))
  })
  test('- 와 _ 를 쓰는 base64url과 패딩 길이 변형을 모두 푼다', () => {
    // 0xfb 0xff 0xbe → 표준 base64 "+/++", base64url "-_--"
    expect(Array.from(urlBase64ToUint8Array('-_--'))).toEqual([0xfb, 0xff, 0xbe])
    expect(Array.from(urlBase64ToUint8Array('QQ'))).toEqual([0x41]) // 패딩 2
    expect(Array.from(urlBase64ToUint8Array('QUI'))).toEqual([0x41, 0x42]) // 패딩 1
    expect(Array.from(urlBase64ToUint8Array(''))).toEqual([])
  })
})

describe('bytesEqual', () => {
  test('내용이 같으면 true, 다르면 false', () => {
    const a = new Uint8Array([1, 2, 3])
    expect(bytesEqual(a.buffer.slice(0), a)).toBe(true)
    expect(bytesEqual(new Uint8Array([1, 2, 4]), a)).toBe(false)
    expect(bytesEqual(new Uint8Array([1, 2]), a)).toBe(false)
    expect(bytesEqual(null, a)).toBe(false)
  })
  test('뷰의 일부(byteOffset)를 정확히 비교한다', () => {
    const whole = new Uint8Array([9, 1, 2, 3, 9])
    expect(bytesEqual(whole.subarray(1, 4), new Uint8Array([1, 2, 3]))).toBe(true)
  })
})

// 서비스 워커(public/push-handler.js)를 가짜 self로 실행해 push·notificationclick 처리를 확인한다.
describe('push-handler.js (서비스 워커)', () => {
  const source = readFileSync(new URL('../public/push-handler.js', import.meta.url), 'utf8')

  function load(clientsList: Array<Record<string, unknown>> = []) {
    const listeners: Record<string, (event: unknown) => void> = {}
    const shown: Array<{ title: string; options: Record<string, unknown> }> = []
    const opened: string[] = []
    const fakeSelf = {
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        listeners[type] = fn
      },
      registration: {
        showNotification: (title: string, options: Record<string, unknown>) => {
          shown.push({ title, options })
          return Promise.resolve()
        },
      },
      clients: {
        matchAll: () => Promise.resolve(clientsList),
        openWindow: (url: string) => {
          opened.push(url)
          return Promise.resolve()
        },
      },
    }
    new Function('self', source)(fakeSelf)
    return { listeners, shown, opened }
  }

  async function dispatch(listener: (event: unknown) => void, event: Record<string, unknown>) {
    let pending: Promise<unknown> = Promise.resolve()
    listener({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p) })
    await pending
  }

  test('push: JSON 본문으로 알림을 띄운다(제목·본문·tag·열 주소)', async () => {
    const { listeners, shown } = load()
    const data = { title: '찜한 책이 소장됐어요', body: '‘책’이(가) 도서관에 들어왔어요.', url: '/', tag: '9788934972464' }
    await dispatch(listeners.push, { data: { json: () => data, text: () => '' } })
    expect(shown).toHaveLength(1)
    expect(shown[0].title).toBe('찜한 책이 소장됐어요')
    expect(shown[0].options.body).toBe('‘책’이(가) 도서관에 들어왔어요.')
    expect(shown[0].options.tag).toBe('9788934972464')
    expect(shown[0].options.data).toEqual({ url: '/' })
  })

  test('push: 본문이 없거나 JSON이 아니어도 알림은 반드시 띄운다(보이지 않는 푸시는 허용되지 않는다)', async () => {
    const empty = load()
    await dispatch(empty.listeners.push, { data: null })
    expect(empty.shown).toHaveLength(1)
    expect(empty.shown[0].title).toBe('gotolib')

    const broken = load()
    await dispatch(broken.listeners.push, {
      data: {
        json: () => {
          throw new Error('not json')
        },
        text: () => '그냥 글자',
      },
    })
    expect(broken.shown).toHaveLength(1)
    expect(broken.shown[0].options.body).toBe('그냥 글자')
  })

  test('notificationclick: 열려 있는 앱이 있으면 그 창을 앞으로 가져온다(새 창을 열지 않는다)', async () => {
    const calls: string[] = []
    const client = {
      focus: () => {
        calls.push('focus')
        return Promise.resolve()
      },
      navigate: (url: string) => {
        calls.push(`navigate ${url}`)
        return Promise.resolve()
      },
    }
    const { listeners, opened } = load([client])
    let closed = false
    await dispatch(listeners.notificationclick, { notification: { close: () => (closed = true), data: { url: '/' } } })
    expect(closed).toBe(true)
    expect(calls).toEqual(['focus', 'navigate /'])
    expect(opened).toEqual([])
  })

  test('notificationclick: 열려 있는 앱이 없으면 새 창을 연다', async () => {
    const { listeners, opened } = load([])
    await dispatch(listeners.notificationclick, { notification: { close: () => {}, data: { url: '/x' } } })
    expect(opened).toEqual(['/x'])
    const none = load([])
    await dispatch(none.listeners.notificationclick, { notification: { close: () => {}, data: null } })
    expect(none.opened).toEqual(['/'])
  })
})
