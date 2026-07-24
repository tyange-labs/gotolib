import { useState } from 'react'
import PWABadge from './PWABadge.tsx'
import { ImportDropzone } from './components/ImportDropzone.tsx'
import { SearchControls } from './components/SearchControls.tsx'
import { SegmentedControl } from './components/SegmentedControl.tsx'
import { useBooks } from './hooks/useBooks.ts'
import { useGeolocation } from './hooks/useGeolocation.ts'
import { REGIONS } from './lib/libraryApi.ts'
import { NearbyView } from './views/NearbyView.tsx'
import { ShelfView } from './views/ShelfView.tsx'
import './App.css'

type Mode = 'shelf' | 'nearby'

const MODES = [
  { value: 'shelf', label: '내 서재' },
  { value: 'nearby', label: '주변 도서관' },
] as const

function App() {
  const { books, loading, error, importFile, removeBook, clearAll } = useBooks()
  const { coords, status: locationStatus, request: requestLocation } =
    useGeolocation()
  const [region, setRegion] = useState<string>(REGIONS[0].code)
  const [mode, setMode] = useState<Mode>('shelf')
  const [notice, setNotice] = useState<string | null>(null)

  const regionName =
    REGIONS.find((r) => r.code === region)?.name ?? REGIONS[0].name

  const handleFile = async (file: File) => {
    setNotice(null)
    const result = await importFile(file)
    if (result) setNotice(`${result.imported}권을 불러왔습니다.`)
  }

  const hasBooks = books.length > 0

  return (
    <div className="app">
      <header className="app__header">
        <h1>gotolib</h1>
        <p className="app__tagline">알라딘 보관함 속 책, 도서관에서 찾기</p>
      </header>

      {hasBooks && (
        <SegmentedControl
          segments={MODES}
          value={mode}
          onChange={(m) => {
            setMode(m)
            setNotice(null)
          }}
        />
      )}

      {mode === 'shelf' && <ImportDropzone onFile={handleFile} />}

      {error && <p className="message message--error">{error}</p>}
      {notice && <p className="message message--notice">{notice}</p>}

      {hasBooks && (
        <SearchControls
          region={region}
          onRegionChange={setRegion}
          locationStatus={locationStatus}
          onRequestLocation={requestLocation}
        />
      )}

      {loading ? (
        <p className="message">불러오는 중…</p>
      ) : !hasBooks ? (
        <p className="message">
          아직 저장된 책이 없어요. 알라딘 보관함 파일을 불러와보세요.
        </p>
      ) : mode === 'shelf' ? (
        <ShelfView
          books={books}
          region={region}
          regionName={regionName}
          coords={coords}
          onRemove={removeBook}
          onClearAll={clearAll}
        />
      ) : (
        <NearbyView region={region} regionName={regionName} coords={coords} />
      )}

      <PWABadge />
    </div>
  )
}

export default App
