import { A } from '@solidjs/router'
import { For, Match, Show, Switch, createMemo, createSignal } from 'solid-js'
import { FavoriteStar } from '../components/FavoriteStar'
import { LoadingMessage } from '../components/Spinner'
import { SearchBar } from '../components/SearchBar'
import { SearchControls } from '../components/SearchControls'
import { useApp } from '../context/appContext'
import { useNearby } from '../context/nearbyContext'

/** '/nearby' index — 도서관 목록 + 이름 검색 */
export function NearbyList() {
  const {
    coords,
    favorites,
    region,
    setRegion,
    locationStatus,
    requestLocation,
  } = useApp()
  const { status, error, libraries, load, reload } = useNearby()
  const [query, setQuery] = createSignal('')

  const filtered = createMemo(() => {
    // solid/reactivity 오탐: filter 콜백은 이 memo 안에서 동기적으로 실행된다.
    // eslint-disable-next-line solid/reactivity
    const q = query().trim().replace(/\s+/g, '')
    if (!q) return libraries()
    return libraries().filter((lib) =>
      lib.libName.replace(/\s+/g, '').includes(q),
    )
  })

  return (
    <div>
      {/* 지역을 바꾸거나 위치로 정렬하는 건 목록을 보겠다는 뜻이라 그때 받는다. */}
      <SearchControls
        region={region()}
        onRegionChange={(next) => {
          setRegion(next)
          load()
        }}
        locationStatus={locationStatus()}
        onRequestLocation={() => {
          requestLocation()
          load()
        }}
      />

      <Show when={favorites.favorites().length > 0}>
        <section class="fav-section">
          <p class="fav-section__title">
            자주 가는 도서관
          </p>
          <ul class="lib-list">
            <For each={favorites.favorites()}>
              {(lib) => (
                <li class="lib-row">
                  <A href={`/nearby/${lib.libCode}`} class="lib-card">
                    <div class="lib-card__body">
                      <span class="lib-card__name">{lib.libName}</span>
                      <span class="lib-card__addr">{lib.address}</span>
                    </div>
                  </A>
                  <FavoriteStar library={lib} />
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <Show when={status() !== 'idle'}>
        <SearchBar
          value={query()}
          onChange={setQuery}
          placeholder="도서관 이름 검색"
        />
      </Show>

      <Switch>
        <Match when={status() === 'idle'}>
          <div class="nearby-prompt">
            <p class="message">
              도서관 목록은 크기가 커서 직접 불러올 때만 받아요.
            </p>
            <button class="primary-button" onClick={load}>
              도서관 불러오기
            </button>
          </div>
        </Match>
        <Match when={status() === 'loading'}>
          <LoadingMessage>도서관을 불러오는 중…</LoadingMessage>
        </Match>
        <Match when={status() === 'error'}>
          <p class="message message--error">
            {error()}{' '}
            <button class="link-button" onClick={reload}>
              다시 시도
            </button>
          </p>
        </Match>
        <Match when={status() === 'loaded'}>
          <div class="list-header">
            <span class="list-header__count">
              {filtered().length}곳
              {coords() ? ' · 가까운 순' : ''}
            </span>
            <button class="text-button" onClick={reload}>
              새로고침
            </button>
          </div>
          <Show
            when={filtered().length > 0}
            fallback={<p class="message">이름에 맞는 도서관이 없어요.</p>}
          >
            <ul class="lib-list">
              <For each={filtered()}>
                {(lib) => (
                  <li class="lib-row">
                    <A href={`/nearby/${lib.libCode}`} class="lib-card">
                      <div class="lib-card__body">
                        <span class="lib-card__name">{lib.libName}</span>
                        <span class="lib-card__addr">{lib.address}</span>
                      </div>
                      <div class="lib-card__meta">
                        <Show when={lib.distance != null}>
                          <span class="lib-card__distance">
                            {lib.distance! < 10
                              ? lib.distance!.toFixed(1)
                              : Math.round(lib.distance!)}
                            km
                          </span>
                        </Show>
                      </div>
                    </A>
                    <FavoriteStar library={lib} />
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Match>
      </Switch>
    </div>
  )
}
