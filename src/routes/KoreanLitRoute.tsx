import { useKoreanNovels } from '../hooks/useKoreanNovels'
import { KoreanLitView } from '../views/KoreanLitView'

/** '/korean-lit' — 한국문학: YES24가 '한국 장편소설'로 분류한 17개 출판사 책(2000년~올해, 연도별) */
export function KoreanLitRoute() {
  const { years, year, setYear, novels, ready, listError, ebookIsbns, progress, error, refresh } = useKoreanNovels()

  return (
    <KoreanLitView
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
