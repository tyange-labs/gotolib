/**
 * '한국문학' 탭의 수집: 국립중앙도서관 서지정보 API(`/api/seoji/search`, 기존 프록시 그대로 재사용)에서
 * 출판사 × 월 단위로 전자책(ebook_yn=Y)을 긁어 한국문학(810) 소설 후보를 만든다.
 * 인수인계 문서 2~4절의 fetch_novels.py 파이프라인을 클라이언트에서 그대로 재현한 것.
 */
import { authorsOf, isbn13Of } from './bookSearch'
import { LibraryApiError } from './libraryApi'
import { kdc3FromAddCode, publisherMatches, readerCodeFromAddCode } from './novelClassify'
import type { NovelCandidate } from '../types/novel'

export interface NovelSeojiDoc {
  TITLE?: string
  AUTHOR?: string
  PUBLISHER?: string
  EA_ISBN?: string
  EA_ADD_CODE?: string
  SET_ISBN?: string
  SET_ADD_CODE?: string
  /** 전자책 레코드에서 종이책 ISBN(쪽수 조회용) */
  RELATED_ISBN?: string
  PUBLISH_PREDATE?: string
  REAL_PUBLISH_DATE?: string
  EBOOK_YN?: string
  /** 'EB' 등. 오디오북은 다른 코드라 FORM으로 걸러낸다 */
  FORM?: string
  PRICE?: string
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed : undefined
}

function yyyymmddOf(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D/g, '')
  return digits && /^\d{8}$/.test(digits) ? digits : undefined
}

function toDate(value: string | undefined): string | undefined {
  const digits = yyyymmddOf(value)
  return digits ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : undefined
}

/** 저자 표기의 쉼표 개수로 공저자 수를 대략 센다("A, B, C" → 3). 역자 표기는 세지 않는다 */
function authorCountOf(raw: string | undefined): number | undefined {
  const main = raw?.split(';')[0]
  if (!main) return undefined
  return main.split(',').map((s) => s.trim()).filter(Boolean).length
}

/** 역자만 있고 지은이가 없는 레코드(번역서가 810으로 잘못 분류된 경우)를 걸러낸다 */
function isTranslationOnly(raw: string | undefined): boolean {
  return /역자|옮긴이|번역/.test(raw ?? '') && !/지은이|저자|글쓴이/.test(raw ?? '')
}

function isAudiobook(form: string | undefined): boolean {
  return /오디오북|낭독/.test(form ?? '')
}

/** 한 레코드를 후보로 바꾼다. 한국문학(810)·독자대상 성인·오디오북 아님·역자만 아님을 만족해야 들어온다 */
function toCandidate(doc: NovelSeojiDoc, publisherQuery: string): NovelCandidate | null {
  const publisher = clean(doc.PUBLISHER)
  const title = clean(doc.TITLE)
  const ebookIsbn13 = isbn13Of(doc.EA_ISBN)
  if (!publisher || !title || !ebookIsbn13 || doc.EBOOK_YN !== 'Y') return null
  if (!publisherMatches(publisher, publisherQuery)) return null
  if (isAudiobook(doc.FORM)) return null
  if (isTranslationOnly(doc.AUTHOR)) return null

  const addCode = doc.EA_ADD_CODE || doc.SET_ADD_CODE
  const kdc3 = kdc3FromAddCode(addCode)
  // 부가기호가 있는데 한국문학(81x)이 아니면 애초에 대상이 아니다(830/840/860 외국문학 등 제외).
  // 없으면(전자책은 흔히 빈 값) 일단 통과시켜 제목·쪽수로 추정한다.
  if (kdc3 && !kdc3.startsWith('81')) return null
  if (readerCodeFromAddCode(addCode) === '7') return null

  return {
    id: ebookIsbn13,
    title,
    author: authorsOf(doc.AUTHOR),
    publisher,
    pubDate: toDate(doc.REAL_PUBLISH_DATE) ?? toDate(doc.PUBLISH_PREDATE),
    ebookIsbn13,
    paperIsbn13: isbn13Of(doc.RELATED_ISBN),
    kdc3,
    authorCount: authorCountOf(doc.AUTHOR),
    price: doc.PRICE ? Number(doc.PRICE.replace(/[^\d]/g, '')) || undefined : undefined,
  }
}

interface SeojiRawResponse {
  RESULT?: string
  ERR_CODE?: string
  ERR_MESSAGE?: string
  /** 013 같은 업무 오류가 아니라 API 게이트웨이 자체가 거부할 때(예: 일일 호출 한도 초과)의 모양 */
  resultCode?: string
  resultMsg?: string
  TOTAL_COUNT?: string | number
  docs?: NovelSeojiDoc[]
}

async function seojiRequest(params: URLSearchParams): Promise<SeojiRawResponse> {
  let res: Response
  try {
    res = await fetch(`/api/seoji/search?${params}`)
  } catch {
    throw new LibraryApiError('국립중앙도서관에 연결하지 못했습니다.')
  }
  if (!res.ok) throw new LibraryApiError(`요청 실패 (HTTP ${res.status})`)
  try {
    return (await res.json()) as SeojiRawResponse
  } catch {
    throw new LibraryApiError('응답을 해석하지 못했습니다.')
  }
}

const MAX_PAGE_SIZE = 100

/**
 * 한 출판사 × 한 달 구간의 전자책 전체를 모은다(페이지 반복). 013(건수 초과) 오류면 page_size를 절반으로
 * 줄여 다시 시도한다(문서 3절). 반환값은 걸러지지 않은 원본 레코드 — 걸러내기는 toCandidates에서 한다.
 */
export async function fetchNovelPeriodRaw(
  publisherQuery: string,
  startYmd: string,
  endYmd: string,
): Promise<NovelSeojiDoc[]> {
  const docs: NovelSeojiDoc[] = []
  let pageSize = MAX_PAGE_SIZE
  let pageNo = 1
  for (;;) {
    const params = new URLSearchParams({
      ebook_yn: 'Y',
      publisher: publisherQuery,
      start_publish_date: startYmd,
      end_publish_date: endYmd,
      sort: 'PUBLISH_PREDATE',
      order_by: 'DESC',
      page_no: String(pageNo),
      page_size: String(pageSize),
    })
    const data = await seojiRequest(params)
    // 정상 응답은 docs가 배열로(결과 0건이면 빈 배열로) 꼭 있다. 없으면 업무 오류(RESULT=ERROR) 거나
    // 게이트웨이 오류(resultCode, 예: 일일 호출 한도 초과)다 — 둘 다 "이번엔 못 가져왔다"로 던져야 한다.
    // 조용히 빈 배열로 넘기면 캐시에 '이 달은 0권'이라고 잘못 영구 저장된다.
    if (!Array.isArray(data.docs)) {
      if (data.RESULT === 'ERROR' && data.ERR_CODE === '013' && pageSize > 10) {
        pageSize = Math.max(10, Math.floor(pageSize / 2))
        continue
      }
      // 010(키 없음)·011(키 오류)·012(필수값 누락)은 이번 요청 자체가 잘못됐다는 뜻이라 던진다(다른 달도 똑같이 실패한다).
      const code = data.ERR_CODE ?? data.resultCode ?? '알 수 없음'
      const message = data.ERR_MESSAGE ?? data.resultMsg
      throw new LibraryApiError(
        `국립중앙도서관 서지정보 API 오류 (${code}${message ? `: ${message}` : ''})`,
      )
    }
    const got = data.docs
    docs.push(...got)
    const total = Number(data.TOTAL_COUNT ?? 0)
    if (got.length === 0 || docs.length >= total || pageNo * pageSize >= total) break
    pageNo += 1
  }
  return docs
}

/** 원본 레코드를 후보로 거른다. 출판사가 여러 개 매칭에 걸릴 수 있어 중복(ISBN) 제거까지 한다 */
export function toCandidates(docs: NovelSeojiDoc[], publisherQuery: string): NovelCandidate[] {
  const seen = new Set<string>()
  const out: NovelCandidate[] = []
  for (const doc of docs) {
    const candidate = toCandidate(doc, publisherQuery)
    if (!candidate || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    out.push(candidate)
  }
  return out
}

/**
 * 2020년부터 올해까지 "yyyy" 목록(과거→현재). 달 단위로 쪼개면 17개 출판사 × 수십 달이라
 * 요청이 너무 많아져(일일 호출 한도를 쉽게 넘긴다) 해 단위로 묻는다 — 한 해 안에서는
 * fetchNovelPeriodRaw가 page_no로 계속 넘겨 받으니 건수가 많아도 상관없다.
 */
export function yearsSince2020(): string[] {
  const years: string[] = []
  const thisYear = new Date().getFullYear()
  for (let y = 2020; y <= thisYear; y++) years.push(String(y))
  return years
}

/** "yyyy" → [그 해 1월 1일, 그 해 12월 31일] (yyyymmdd) */
export function yearWindow(yyyy: string): [string, string] {
  return [`${yyyy}0101`, `${yyyy}1231`]
}
