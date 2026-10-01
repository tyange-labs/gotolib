import * as XLSX from 'xlsx'
// 코드페이지 테이블: 레거시 xls 파일의 한글(CP949) 텍스트 디코딩에 필요
import * as cptable from 'xlsx/dist/cpexcel.full.mjs'
import type { Book } from '../types/book'

XLSX.set_cptable(cptable)

/**
 * 알라딘 보관함 내보내기 파일(xls/xlsx/csv)을 파싱한다.
 * 내보내기 포맷이 바뀌어도 동작하도록 헤더 행을 찾아 컬럼명을 매칭하는 방식을 쓴다.
 */
export function parseAladinExport(buffer: ArrayBuffer): Book[] {
  const workbook = readWorkbook(buffer)

  // 알라딘 내보내기는 HTML 테이블 여러 개가 시트 여러 개로 읽히므로
  // 도서 목록 헤더가 있는 시트를 찾는다.
  let rows: unknown[][] | null = null
  let headerIndex = -1
  for (const name of workbook.SheetNames) {
    const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[name],
      { header: 1, raw: false, defval: '' },
    )
    const found = sheetRows.findIndex((row) =>
      row.some((cell) => COLUMN_MATCHERS.title[0].test(normalize(cell))),
    )
    if (found !== -1) {
      rows = sheetRows
      headerIndex = found
      break
    }
  }
  if (!rows || headerIndex === -1) {
    throw new ParseError(
      '도서 목록 헤더(상품명/도서명 등)를 찾을 수 없습니다. 알라딘 보관함 내보내기 파일이 맞는지 확인해주세요.',
    )
  }

  const columnOf = mapColumns(rows[headerIndex])
  const importedAt = Date.now()
  // 내보내기 파일은 보관함에 최근 담은 책이 위에 온다. 담긴 날짜는 '일' 단위라
  // 같은 날 담은 책끼리는 파일 순서로 가른다(앞선 행일수록 1ms씩 더 최신).
  const rowCount = rows.length - headerIndex - 1
  let lastDay: number | undefined
  const books: Book[] = []

  for (const row of rows.slice(headerIndex + 1)) {
    const title = cellAt(row, columnOf.title)
    if (!title) continue

    const isbn13 = extractIsbn13(cellAt(row, columnOf.isbn))
    const author = cellAt(row, columnOf.author)
    const publisher = cellAt(row, columnOf.publisher)
    const pubDate = formatDate(cellAt(row, columnOf.pubDate))
    const priceText = cellAt(row, columnOf.price)
    const price = priceText
      ? Number(priceText.replace(/[^\d]/g, '')) || undefined
      : undefined

    // 제목만 있고 다른 정보가 전혀 없는 행은 도서가 아니다 (알라딘 푸터 문구 등)
    if (!author && !publisher && !pubDate && !isbn13 && !price) continue

    // 날짜 칸이 비어 있으면 바로 앞 행의 날짜를 이어받아 파일 속 위치를 지킨다.
    lastDay = parseDay(cellAt(row, columnOf.listedAt)) ?? lastDay
    const addedAt = (lastDay ?? importedAt) + (rowCount - books.length)

    books.push({
      id: isbn13 ?? fallbackId(title, author),
      title,
      author,
      publisher,
      pubDate,
      isbn13,
      price,
      genre: cellAt(row, columnOf.genre),
      kdc: kdcFromBugah(cellAt(row, columnOf.bugah)),
      addedAt,
    })
  }

  if (books.length === 0) {
    throw new ParseError('파일에서 도서를 하나도 찾지 못했습니다.')
  }
  return books
}

export class ParseError extends Error {}

/**
 * xls/xlsx는 매직 바이트로 판별해 바이너리로 읽고,
 * 그 외(csv 등)는 텍스트로 취급해 UTF-8 → EUC-KR 순으로 디코딩한다.
 * (SheetJS의 codepage 옵션은 텍스트 파일에 적용되지 않는다)
 */
function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  const head = new Uint8Array(buffer.slice(0, 4))
  const isZip = head[0] === 0x50 && head[1] === 0x4b // xlsx
  const isCfb =
    head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0 // xls
  if (isZip || isCfb) {
    return XLSX.read(buffer, { type: 'array', codepage: 949 })
  }
  return XLSX.read(decodeText(buffer), { type: 'string' })
}

function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('euc-kr').decode(buffer)
  }
}

// 각 필드의 후보 정규식. 앞에 있을수록 우선한다 (예: ISBN13 컬럼이 ISBN보다 우선).
const COLUMN_MATCHERS = {
  title: [/상품명|도서명|^제목$/],
  author: [/저자|아티스트|글쓴이|지은이/],
  publisher: [/출판사|제작사/],
  pubDate: [/출간일|발행일|출시일/],
  isbn: [/isbn.?13/i, /isbn/i],
  price: [/판매가|정가|가격/],
  genre: [/^분야$/, /분야|장르|카테고리/],
  bugah: [/^부가기호$/, /부가기호/],
  listedAt: [/담긴\s*날짜|담은\s*날짜/],
} satisfies Record<string, RegExp[]>

type ColumnKey = keyof typeof COLUMN_MATCHERS

function mapColumns(headerRow: unknown[]) {
  const columnOf = {} as Record<ColumnKey, number | undefined>
  for (const key of Object.keys(COLUMN_MATCHERS) as ColumnKey[]) {
    columnOf[key] = undefined
    for (const matcher of COLUMN_MATCHERS[key]) {
      const index = headerRow.findIndex((cell) => matcher.test(normalize(cell)))
      if (index !== -1) {
        columnOf[key] = index
        break
      }
    }
  }
  return columnOf
}

function normalize(cell: unknown): string {
  return String(cell ?? '').trim()
}

function cellAt(row: unknown[], index: number | undefined): string | undefined {
  if (index === undefined) return undefined
  return normalize(row[index]) || undefined
}

/**
 * ISBN 부가기호(5자리: [독자대상][발행형태][내용분류 3자리])에서 KDC 주류 한 자리를 뽑는다.
 * 내용분류기호 3자리의 첫 자리(=전체 3번째 자리)가 KDC 주류(0~9)다. 예: "03810" → "8"(문학).
 */
function kdcFromBugah(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D/g, '') ?? ''
  return digits.length >= 5 ? digits[2] : undefined
}

/** "20261001" 또는 "2026-10-01" → 그날 0시(UTC)의 ms. 형식이 다르면 undefined */
function parseDay(value: string | undefined): number | undefined {
  const m = value?.match(/^(\d{4})\D?(\d{2})\D?(\d{2})/)
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined
}

/** "20260715" 같은 YYYYMMDD 형식을 "2026-07-15"로 바꾼다 */
function formatDate(value: string | undefined): string | undefined {
  if (value && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
  }
  return value
}

function extractIsbn13(value: string | undefined): string | undefined {
  const digits = value?.replace(/[^\dXx]/g, '') ?? ''
  return /^97[89]\d{10}$/.test(digits) ? digits : undefined
}

function fallbackId(title: string, author?: string): string {
  const source = `${title}|${author ?? ''}`
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0
  }
  return `local-${(hash >>> 0).toString(36)}`
}
