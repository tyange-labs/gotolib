/**
 * '한국문학' 탭의 장르 칩. 장르를 늘릴 때는 여기에 한 줄을 넣고, 서버 `GET /gotolib/korean-novels`의
 * `form` 값(그리고 그 장르를 모으는 YES24 수집)을 같이 늘린다. 첫 줄이 기본 장르다(`/korean-lit`).
 */
export interface KoreanGenre {
  /** 주소(`/korean-lit/short`)와 서버 `form` 값 */
  slug: string
  /** 칩 글자 */
  label: string
  /** 안내 문구에 들어가는 YES24 분류 이름 */
  yes24Category: string
}

export const KOREAN_GENRES: readonly KoreanGenre[] = [
  { slug: 'novel', label: '장편', yes24Category: '한국 장편소설' },
  { slug: 'short', label: '단편', yes24Category: '한국 단편소설' },
]

/** 주소의 장르 조각 → 장르. 없거나 모르는 값이면 기본 장르 */
export function genreOf(slug: string | undefined): KoreanGenre {
  return KOREAN_GENRES.find((genre) => genre.slug === slug) ?? KOREAN_GENRES[0]
}

export function genrePath(genre: KoreanGenre): string {
  return genre === KOREAN_GENRES[0] ? '/korean-lit' : `/korean-lit/${genre.slug}`
}
