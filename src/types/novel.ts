/**
 * '한국문학' 탭 목록의 책 한 권: 서버가 YES24 "한국 장편소설" 분류에서 모은 종이책
 * (`GET /gotolib/korean-novels`). 전자책 여부만 NL 서지정보 API로 따로 채운다.
 */
export interface KoreanNovel {
  /** 종이책 ISBN13(YES24 상품 페이지에서 받은 값) */
  id: string
  /** YES24 상품 번호 — 상품 페이지 링크용 */
  goodsNo: number
  title: string
  subtitle?: string
  /** "양귀자" 처럼 끝의 " 저"를 뗀 표기 */
  author?: string
  publisher: string
  /** "2026-11" (YES24 목록은 출간 연월까지만 준다) */
  pubMonth?: string
}

/** NL 서지정보 API의 전자책 레코드에서 만든 후보. '한국문학' 탭에서는 전자책 여부 표시에만 쓴다. */

export interface NovelCandidate {
  /** 단행본(종이책) ISBN13. 종이책이 없으면 전자책 ISBN13으로 대신한다 */
  id: string
  title: string
  author?: string
  publisher: string
  /** 전자책 출간(예정)일 "YYYY-MM-DD" */
  pubDate?: string
  ebookIsbn13: string
  /** 종이책 ISBN13(RELATED_ISBN에서 도출). 쪽수 조회에 쓴다. 세트 상품은 없을 수 있다 */
  paperIsbn13?: string
  /** 부가기호 내용분류 3자리(예: "813"). 없으면 undefined */
  kdc3?: string
  /** 공저자 수(저자 표기에서 ','로 센 대략치, 1 미만이면 undefined) */
  authorCount?: number
  price?: number
}
