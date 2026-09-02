import { A } from '@solidjs/router'
import { ChevronRight } from 'lucide-solid'
import { For, Match, Show, Switch, createMemo, createSignal } from 'solid-js'
import { FavoriteStar } from '../components/FavoriteStar'
import { SearchBar } from '../components/SearchBar'
import { useApp } from '../context/appContext'
import { useNearby } from '../context/nearbyContext'

/** '/nearby' index — 도서관 목록 + 이름 검색 */
export function NearbyList() {
  const { regionName, coords, favorites } = useApp()
  const { status, error, libraries, reload } = useNearby()
  const [query, setQuery] = createSignal('')

  const filtered = createMemo(() => {
    const q = query().trim().replace(/\s+/g, '')
    if (!q) return libraries()
    return libraries().filter((lib) =>
      lib.libName.replace(/\s+/g, '').includes(q),
    )
  })

  return (
    <div>
      <Show when={favorites.favorites().length > 0}>
        <section class="fav-section">
          <p class="fav-section__title">
            ★ 자주 가는 도서관 {favorites.favorites().length}
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
                    <ChevronRight class="lib-card__chevron" size={18} aria-hidden />
                  </A>
                  <FavoriteStar library={lib} />
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <SearchBar
        value={query()}
        onChange={setQuery}
        placeholder="도서관 이름 검색"
      />

      <Switch>
        <Match when={status() === 'loading'}>
          <p class="message">{regionName()} 도서관을 불러오는 중…</p>
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
              {regionName()} · {filtered().length}곳
              {coords() ? ' · 가까운 순' : ''}
            </span>
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
                        <span class="lib-card__chevron" aria-hidden>
                          ›
                        </span>
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
