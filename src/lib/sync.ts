/**
 * 기기 간 동기화: 서버 문서를 받아 로컬과 합치고(syncDoc), 저장소에 반영하고(syncStore),
 * 달라졌으면 다시 올린다. 서버는 내용을 해석하지 않고 `version`으로 충돌만 막는다.
 */
import { createSignal } from 'solid-js'
import { AuthError, api, isTransient, session } from './auth'
import { onLocalChange } from './localEvents'
import {
  canonical,
  limitDoc,
  mergeDocs,
  normalizeDoc,
  parseDoc,
  type SyncDoc,
} from './syncDoc'
import { applySyncDoc, readSyncDoc } from './syncStore'

interface RemoteDocument {
  version: number
  data: unknown
  updated_at: string | null
}

export type SyncStatus = 'idle' | 'syncing' | 'error'

const [syncStatus, setSyncStatus] = createSignal<SyncStatus>('idle')
const [lastSyncedAt, setLastSyncedAt] = createSignal<number | null>(null)
const [syncError, setSyncError] = createSignal<string | null>(null)
/** 상한(SYNC_MAX_BOOKS) 때문에 서버에 올리지 않은 책 수. 0이면 전부 올라간 것. */
const [omittedBooks, setOmittedBooks] = createSignal(0)
export { lastSyncedAt, omittedBooks, syncError, syncStatus }

/** 다른 기기와 동시에 올려 409가 나면 최신 문서와 다시 합쳐 재시도하는 최대 횟수. */
const MAX_ATTEMPTS = 4

const isEmpty = (doc: SyncDoc) =>
  Object.keys(doc.books).length +
    Object.keys(doc.watchlist).length +
    Object.keys(doc.favLibraries).length ===
  0

async function syncOnce(): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remote = await api<RemoteDocument>('/gotolib/sync')
    const remoteDoc = parseDoc(remote.data)

    const local = await readSyncDoc()
    const applied = await applySyncDoc(normalizeDoc(mergeDocs(local, remoteDoc)))
    // 이 기기에는 전부 반영하되, 서버에는 상한까지 줄인 문서만 올린다.
    const { doc, omittedBooks: omitted } = limitDoc(applied.doc)
    setOmittedBooks(omitted)

    // 서버에 이미 같은 내용이 있거나, 양쪽 다 비어 있어 올릴 게 없으면 끝.
    if (canonical(doc) === canonical(remoteDoc)) return
    if (remote.version === 0 && isEmpty(doc)) return

    try {
      await api('/gotolib/sync', {
        method: 'PUT',
        json: { base_version: remote.version, data: doc },
      })
      return
    } catch (e) {
      if (e instanceof AuthError && e.status === 409) continue
      throw e
    }
  }
  throw new AuthError('다른 기기와 계속 충돌해서 동기화하지 못했습니다. 잠시 후 다시 시도하세요.')
}

let running: Promise<void> | null = null
let rerun = false

/** 일시적인 오류(서버가 다시 뜨는 중 등)면 이 간격으로 몇 번 다시 시도한다. 성공하면 처음으로. */
const RETRY_DELAYS_MS = [10_000, 30_000, 60_000]
let retries = 0

/** 지금 동기화한다. 이미 돌고 있으면 끝난 뒤 한 번 더 돈다(그 사이의 변경을 놓치지 않게). */
export function syncNow(): Promise<void> {
  if (!session()) return Promise.resolve()
  if (running) {
    rerun = true
    return running
  }
  setSyncStatus('syncing')
  running = (async () => {
    try {
      await syncOnce()
      retries = 0
      setLastSyncedAt(Date.now())
      setSyncError(null)
      setSyncStatus('idle')
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : '동기화에 실패했습니다.')
      setSyncStatus('error')
      // 배포로 서버가 잠깐 내려간 경우처럼 곧 풀릴 오류는 사용자가 누르지 않아도 다시 시도한다.
      if (isTransient(e) && retries < RETRY_DELAYS_MS.length) {
        setTimeout(() => void syncNow(), RETRY_DELAYS_MS[retries++])
      }
    } finally {
      running = null
      if (rerun) {
        rerun = false
        void syncNow()
      }
    }
  })()
  return running
}

/**
 * 로그인한 동안 자동 동기화: 시작할 때, 이 기기에서 바꾼 뒤(잠시 모아서), 탭이 다시 보일 때,
 * 네트워크가 돌아왔을 때. 돌려받은 함수로 해제한다.
 */
export function startAutoSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), 1500)
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }
  const stopLocal = onLocalChange(schedule)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onVisible)
  void syncNow()

  return () => {
    clearTimeout(timer)
    stopLocal()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onVisible)
  }
}
