import { useParams } from '@solidjs/router'
import { useKoreanNovels } from '../hooks/useKoreanNovels'
import { genreOf } from '../lib/koreanGenres'
import { KoreanLitView } from '../views/KoreanLitView'

/**
 * '/korean-lit/:genre?' — 한국문학: YES24 분류(장편 `/korean-lit`, 단편 `/korean-lit/short`)에 든
 * 17개 출판사 책(2000년~올해, 연도별). 장르는 주소에 있어 새로고침·공유해도 같은 장르가 열린다.
 */
export function KoreanLitRoute() {
  const params = useParams<{ genre?: string }>()
  const genre = () => genreOf(params.genre)
  const { years, year, setYear, novels, ready, listError, ebookIsbns, progress, error, refresh } = useKoreanNovels(
    () => genre().slug,
  )

  return (
    <KoreanLitView
      genre={genre()}
      novels={novels()}
      ebookIsbns={ebookIsbns()}
      years={years}
      year={year()}
      onYearChange={setYear}
      ready={ready()}
      listError={listError()}
      progress={progress()}
      ebookError={error()}
      onRefresh={refresh}
    />
  )
}
