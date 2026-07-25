import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FavoriteStar } from '../components/FavoriteStar'
import { SearchBar } from '../components/SearchBar'
import { useApp } from '../context/appContext'
import { useNearby } from '../context/nearbyContext'

/** '/nearby' index — 도서관 목록 + 이름 검색 */
export function NearbyList() {
  const { regionName, coords, favorites } = useApp()
  const { status, error, libraries, reload } = useNearby()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().replace(/\s+/g, '')
    if (!q) return libraries
    return libraries.filter((lib) => lib.libName.replace(/\s+/g, '').includes(q))
  }, [libraries, query])

  return (
    <div>
      {favorites.favorites.length > 0 && (
        <section className="fav-section">
          <p className="fav-section__title">
            ★ 자주 가는 도서관 {favorites.favorites.length}
          </p>
          <ul className="lib-list">
            {favorites.favorites.map((lib) => (
              <li key={lib.libCode} className="lib-row">
                <Link
                  to="/nearby/$libCode"
                  params={{ libCode: lib.libCode }}
                  className="lib-card"
                >
                  <div className="lib-card__body">
                    <span className="lib-card__name">{lib.libName}</span>
                    <span className="lib-card__addr">{lib.address}</span>
                  </div>
                  <ChevronRight className="lib-card__chevron" size={18} aria-hidden />
                </Link>
                <FavoriteStar library={lib} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <SearchBar value={query} onChange={setQuery} placeholder="도서관 이름 검색" />

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
              {regionName} · {filtered.length}곳{coords ? ' · 가까운 순' : ''}
            </span>
          </div>
          {filtered.length === 0 ? (
            <p className="message">이름에 맞는 도서관이 없어요.</p>
          ) : (
            <ul className="lib-list">
              {filtered.map((lib) => (
                <li key={lib.libCode} className="lib-row">
                  <Link
                    to="/nearby/$libCode"
                    params={{ libCode: lib.libCode }}
                    className="lib-card"
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
                  </Link>
                  <FavoriteStar library={lib} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
