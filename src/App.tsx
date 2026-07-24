import { useRef, useState } from 'react'
import PWABadge from './PWABadge.tsx'
import { BookList } from './components/BookList.tsx'
import { ImportDropzone } from './components/ImportDropzone.tsx'
import { Pagination } from './components/Pagination.tsx'
import { SearchControls } from './components/SearchControls.tsx'
import { useBooks } from './hooks/useBooks.ts'
import { useGeolocation } from './hooks/useGeolocation.ts'
import { usePagination } from './hooks/usePagination.ts'
import { REGIONS } from './lib/libraryApi.ts'
import './App.css'

const PAGE_SIZE = 20

function App() {
  const { books, loading, error, importFile, removeBook, clearAll } = useBooks()
  const { coords, status: locationStatus, request: requestLocation } =
    useGeolocation()
  const [region, setRegion] = useState<string>(REGIONS[0].code)
  const [notice, setNotice] = useState<string | null>(null)
  const listTopRef = useRef<HTMLDivElement>(null)

  const {
    page,
    pageCount,
    pageItems,
    rangeStart,
    rangeEnd,
    total,
    setPage,
  } = usePagination(books, PAGE_SIZE)

  const regionName =
    REGIONS.find((r) => r.code === region)?.name ?? REGIONS[0].name

  const goToPage = (next: number) => {
    setPage(next)
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleFile = async (file: File) => {
    setNotice(null)
    const result = await importFile(file)
    if (result) {
      setNotice(`${result.imported}권을 불러왔습니다.`)
      setPage(1)
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>gotolib</h1>
        <p className="app__tagline">알라딘 보관함 속 책, 도서관에서 찾기</p>
      </header>

      <ImportDropzone onFile={handleFile} />

      {error && <p className="message message--error">{error}</p>}
      {notice && <p className="message message--notice">{notice}</p>}

      {loading ? (
        <p className="message">불러오는 중…</p>
      ) : books.length > 0 ? (
        <>
          <SearchControls
            region={region}
            onRegionChange={setRegion}
            locationStatus={locationStatus}
            onRequestLocation={requestLocation}
          />
          <div className="list-header" ref={listTopRef}>
            <span className="list-header__count">
              {rangeStart}–{rangeEnd} / {total}권
            </span>
            <button
              className="list-header__clear"
              onClick={() => {
                if (confirm('저장된 도서 목록을 모두 삭제할까요?')) clearAll()
              }}
            >
              전체 삭제
            </button>
          </div>
          <BookList
            books={pageItems}
            region={region}
            regionName={regionName}
            coords={coords}
            onRemove={removeBook}
          />
          <Pagination page={page} pageCount={pageCount} onChange={goToPage} />
        </>
      ) : (
        <p className="message">
          아직 저장된 책이 없어요. 알라딘 보관함 파일을 불러와보세요.
        </p>
      )}

      <PWABadge />
    </div>
  )
}

export default App
