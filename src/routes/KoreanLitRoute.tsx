import { useKoreanNovels } from '../hooks/useKoreanNovels'
import { KoreanLitView } from '../views/KoreanLitView'

/** '/korean-lit' — 한국문학: 전자책으로 나온 한국 장편소설 후보 목록(2000년~올해, 연도별) */
export function KoreanLitRoute() {
  const { years, year, setYear, yearCounts, candidates, ready, progress, error, refresh } = useKoreanNovels()

  return (
    <KoreanLitView
      novels={candidates()}
      years={years}
      year={year()}
      onYearChange={setYear}
      yearCounts={yearCounts()}
      ready={ready()}
      progress={progress()}
      error={error()}
      onRefresh={refresh}
    />
  )
}
