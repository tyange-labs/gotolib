import { useMemo, useState } from 'react'
import { LibraryDetail } from '../components/LibraryDetail'
import { SearchBar } from '../components/SearchBar'
import {
  useNearbyLibraries,
  type NearbyLibrary,
} from '../hooks/useNearbyLibraries'
import type { Coords } from '../lib/geo'

interface Props {
  region: string
  regionName: string
  coords: Coords | null
}

export function NearbyView({ region, regionName, coords }: Props) {
  const { status, error, libraries, reload } = useNearbyLibraries(region, coords)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<NearbyLibrary | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().replace(/\s+/g, '')
    if (!q) return libraries
    return libraries.filter((lib) =>
      lib.libName.replace(/\s+/g, '').includes(q),
    )
  }, [libraries, query])

  if (selected) {
    return <LibraryDetail library={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div>
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="도서관 이름 검색"
      />

      {status === 'loading' && (
        <p className="message">{regionName} 도서관을 불러오는 중…</p>
      )}
      {status === 'error' && (
        <p className="message message--error">
          {error}{' '}
          <button className="link-button" onClick={reload}>
            다시 시도
          </button>
        </p>
      )}
      {status === 'loaded' && (
        <>
          <div className="list-header">
            <span className="list-header__count">
              {regionName} · {filtered.length}곳
              {coords ? ' · 가까운 순' : ''}
            </span>
          </div>
          {filtered.length === 0 ? (
            <p className="message">이름에 맞는 도서관이 없어요.</p>
          ) : (
            <ul className="lib-list">
              {filtered.map((lib) => (
                <li key={lib.libCode}>
                  <button
                    className="lib-card"
                    onClick={() => setSelected(lib)}
                  >
                    <div className="lib-card__body">
                      <span className="lib-card__name">{lib.libName}</span>
                      <span className="lib-card__addr">{lib.address}</span>
                    </div>
                    <div className="lib-card__meta">
                      {lib.distance != null && (
                        <span className="lib-card__distance">
                          {lib.distance < 10
                            ? lib.distance.toFixed(1)
                            : Math.round(lib.distance)}
                          km
                        </span>
                      )}
                      <span className="lib-card__chevron" aria-hidden>
                        ›
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
