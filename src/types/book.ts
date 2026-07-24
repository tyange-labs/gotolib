export interface Book {
  /** isbn13이 있으면 isbn13, 없으면 제목+저자 기반 해시 */
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  pubDate?: string;
  isbn13?: string;
  price?: number;
  /** 알라딘 '분야' 원본값 (예: "2000년대 이후 한국소설"). 참고용으로 보존 */
  genre?: string;
  /** KDC 주류 기호 한 자리 '0'~'9' (부가기호 내용분류기호 첫자리에서 도출). 없으면 undefined */
  kdc?: string;
  addedAt: number;
}
