/**
 * '한국문학' 탭 목록: 서버가 YES24 "한국 장편소설" 분류에서 모은 17개 출판사 종이책(`GET /gotolib/korean-novels`).
 * 서버는 DB만 보고 YES24에는 가지 않는다(수집은 서버의 수집 작업 한 곳에서 한다).
 */
import { api } from './auth'
import type { KoreanNovel } from '../types/novel'

interface ServerBook {
  isbn13: string
  goodsNo: number
  title: string
  subtitle?: string
  author?: string
  publisher?: string
  pubMonth?: string
}

interface ServerResponse {
  year: string
  books: ServerBook[]
}

/** YES24 저자 표기("양귀자 저", "A, B 저/C 역")에서 끝의 " 저"만 뗀다. 역자 표기는 그대로 둔다 */
export function cleanAuthor(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/\s*저$/, '').trim()
  return cleaned ? cleaned : undefined
}

export function toKoreanNovel(book: ServerBook): KoreanNovel {
  return {
    id: book.isbn13,
    goodsNo: book.goodsNo,
    title: book.title,
    subtitle: book.subtitle,
    author: cleanAuthor(book.author),
    publisher: book.publisher ?? '',
    pubMonth: book.pubMonth,
  }
}

export async function fetchKoreanNovels(year: string): Promise<KoreanNovel[]> {
  const response = await api<ServerResponse>(`/gotolib/korean-novels?year=${encodeURIComponent(year)}`, {
    auth: false,
  })
  return response.books.map(toKoreanNovel)
}

/** YES24 상품 페이지 링크 */
export function yes24ProductUrl(goodsNo: number): string {
  return `https://www.yes24.com/product/goods/${goodsNo}`
}
