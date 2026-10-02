/**
 * IndexedDB ↔ 동기화 문서. 합치기 규칙(syncDoc.ts)은 여기서 모른다: 읽어서 문서로 만들고,
 * 합쳐진 문서와 달라진 항목만 저장소에 반영한다.
 */
import { TOMB, getDB } from './db'
import {
  canonical,
  emptyDoc,
  mergeDocs,
  normalizeDoc,
  type FavLibraryValue,
  type SyncDoc,
  type SyncEntry,
  type WatchEntryValue,
} from './syncDoc'
import { emitDataApplied } from './localEvents'
import type { Book } from '../types/book'

type Domain = 'books' | 'watchlist' | 'favLibraries'

const PREFIX: Record<string, Domain> = {
  'b:': 'books',
  'w:': 'watchlist',
  'l:': 'favLibraries',
}

function splitKey(key: string): [Domain, string] | null {
  const domain = PREFIX[key.slice(0, 2)]
  return domain ? [domain, key.slice(2)] : null
}

/**
 * 문서에 넣는 책 값: 화면이 읽는 필드만 명시적으로 고른다. updatedAt은 `at`이 대신하고, 가격·분야 원문은
 * 가져오기(parseAladin)가 저장은 하지만 아무 화면도 읽지 않아서 뺀다 — 서버 문서를 줄인다.
 * 발행연도(pubDate)는 판본이 다른 같은 제목을 구분하려고 카드에 보여주므로 포함한다(연도 4자리만 올린다).
 * 새 필드를 화면에서 읽게 되면 여기에 추가해야 다른 기기에서도 보인다.
 */
function bookValue(book: Book): Book {
  const { id, title, author, publisher, isbn13, kdc, addedAt } = book
  const pubDate = book.pubDate?.match(/^\d{4}/)?.[0]
  return { id, title, author, publisher, pubDate, isbn13, kdc, addedAt }
}

export async function readSyncDoc(): Promise<SyncDoc> {
  const db = await getDB()
  const [books, watch, favs, tombs] = await Promise.all([
    db.getAll('books'),
    db.getAll('watchlist'),
    db.getAll('favLibraries'),
    db.getAll('tombstones'),
  ])

  const doc = emptyDoc()
  for (const book of books) {
    doc.books[book.id] = { at: book.updatedAt ?? book.addedAt, value: bookValue(book) }
  }
  // 찜·자주 가는 도서관은 담은 시각(addedAt)이 곧 마지막으로 바뀐 시각이다.
  for (const item of watch) {
    doc.watchlist[item.bookId] = { at: item.addedAt, value: item }
  }
  for (const lib of favs) {
    doc.favLibraries[lib.libCode] = { at: lib.addedAt, value: lib }
  }
  for (const tomb of tombs) {
    const parsed = splitKey(tomb.key)
    if (!parsed) continue
    const [domain, id] = parsed
    const live = doc[domain][id] as SyncEntry<unknown> | undefined
    // 삭제 표시가 살아 있는 항목보다 늦거나 같으면 삭제가 이긴다(합치기의 동률 규칙과 같다).
    if (!live || tomb.at >= live.at) {
      ;(doc[domain] as Record<string, SyncEntry<unknown>>)[id] = {
        at: tomb.at,
        deleted: true,
      }
    }
  }
  return doc
}

/**
 * 합쳐진 문서를 저장소에 반영하고, 실제로 반영된 최종 문서를 돌려준다.
 *
 * 합치는 동안(네트워크를 기다리는 사이) 사용자가 이 기기에서 바꾼 것이 있을 수 있어서, 쓰기 직전에
 * 현재 로컬 상태와 한 번 더 합친다. 그래야 더 최근의 로컬 변경이 오래된 스냅샷으로 만든 결과에
 * 덮어써지지 않는다. 달라진 항목만 쓰고, 바뀐 게 있을 때만 화면에 알린다.
 */
export async function applySyncDoc(
  incoming: SyncDoc,
): Promise<{ changed: boolean; doc: SyncDoc }> {
  const local = await readSyncDoc()
  const merged = normalizeDoc(mergeDocs(local, incoming))
  const db = await getDB()
  const tx = db.transaction(
    ['books', 'watchlist', 'favLibraries', 'tombstones'],
    'readwrite',
  )
  const writes: Promise<unknown>[] = []
  let changed = false

  const tombstones = tx.objectStore('tombstones')
  const each = <T>(
    domain: Domain,
    key: (id: string) => string,
    put: (id: string, entry: SyncEntry<T>) => Promise<unknown> | undefined,
    remove: (id: string) => Promise<unknown> | undefined,
  ) => {
    const mergedRecord = merged[domain] as Record<string, SyncEntry<T>>
    const localRecord = local[domain] as Record<string, SyncEntry<T>>
    for (const [id, entry] of Object.entries(mergedRecord)) {
      if (canonical(localRecord[id]) === canonical(entry)) continue
      changed = true
      if (entry.deleted) {
        writes.push(remove(id) ?? Promise.resolve())
        writes.push(tombstones.put({ key: key(id), at: entry.at }))
      } else {
        writes.push(put(id, entry) ?? Promise.resolve())
        writes.push(tombstones.delete(key(id)))
      }
    }
  }

  each<Book>(
    'books',
    TOMB.book,
    (_id, entry) =>
      entry.value
        ? tx.objectStore('books').put({ ...entry.value, updatedAt: entry.at })
        : undefined,
    (id) => tx.objectStore('books').delete(id),
  )
  each<WatchEntryValue>(
    'watchlist',
    TOMB.watch,
    (_id, entry) =>
      entry.value ? tx.objectStore('watchlist').put(entry.value) : undefined,
    (id) => tx.objectStore('watchlist').delete(id),
  )
  each<FavLibraryValue>(
    'favLibraries',
    TOMB.lib,
    (_id, entry) =>
      entry.value ? tx.objectStore('favLibraries').put(entry.value) : undefined,
    (id) => tx.objectStore('favLibraries').delete(id),
  )

  await Promise.all(writes)
  await tx.done
  if (changed) emitDataApplied()
  return { changed, doc: merged }
}
