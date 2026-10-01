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
  /** 보관함에 담은 시각(ms). 같은 날은 파일 순서로 가른 값. 날짜가 없으면 가져온 시각 */
  addedAt: number;
  /** 이 기기 저장소에 마지막으로 쓴 시각(ms). 동기화의 '마지막으로 바뀐 시각'. 가져올 때마다 갱신된다 */
  updatedAt?: number;
}
