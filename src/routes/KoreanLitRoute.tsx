import { useKoreanNovels } from '../hooks/useKoreanNovels'
import { KoreanLitView } from '../views/KoreanLitView'

/** '/korean-lit' — 한국문학: 전자책으로 나온 2020년대 한국 장편소설 후보 목록 */
export function KoreanLitRoute() {
  const { candidates, ready, progress, error, refresh } = useKoreanNovels()

  return (
    <KoreanLitView
      novels={candidates()}
      ready={ready()}
      progress={progress()}
      error={error()}
      onRefresh={refresh}
    />
  )
}
