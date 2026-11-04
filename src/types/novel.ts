/** '한국문학' 탭: 전자책 서지(NL 서지정보 API)로 모은 2020년대 한국 장편소설 후보. */
export type NovelVerdict = '장편' | '소설집·중편' | '확인 필요' | '소설 아님'

export interface NovelCandidate {
  /** 전자책 ISBN13 */
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
