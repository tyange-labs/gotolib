export interface Book {
  /** isbn13이 있으면 isbn13, 없으면 제목+저자 기반 해시 */
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  pubDate?: string;
  isbn13?: string;
  price?: number;
  addedAt: number;
}
