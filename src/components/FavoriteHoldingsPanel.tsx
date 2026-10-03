import { A } from '@solidjs/router'
import { ChevronDown, ChevronUp } from 'lucide-solid'
import { For, Show, createResource, createSignal } from 'solid-js'
import type { FavHolding, LoanState } from '../hooks/useFavoriteHoldings'
import { callSignOf } from '../lib/holdingInfo'
import { mapLinks, telHref, webUrl } from '../lib/libraryLinks'
import { fetchHolding } from '../lib/queries'
import { Spinner } from './Spinner'

interface Props {
  holdings: FavHolding[] | null
  favoritesCount: number
  /** 도서관별 분류번호·청구기호를 찾는 데 쓴다 */
  isbn13?: string
}

export function FavoriteHoldingsPanel(props: Props) {
  return (
    <Show
      when={props.favoritesCount > 0}
      fallback={
        <div class="holdings">
          <p class="holdings__status">
            먼저 <A href="/nearby">주변 도서관</A>에서 자주 가는 도서관을
            등록하세요.
          </p>
        </div>
      }
    >
      <Show when={props.holdings}>
        {(holdings) => (
          <div class="holdings">
            <ul class="holdings__list">
              <For each={holdings()}>
                {(entry) => <HoldingItem entry={entry} isbn13={props.isbn13} />}
              </For>
            </ul>
            <p class="holdings__note">
              대출 가능 여부는 도서관정보나루 자료라 실제와 다를 수 있어요. 가기 전에 도서관에
              전화나 홈페이지로 확인하세요.
            </p>
          </div>
        )}
      </Show>
    </Show>
  )
}

/** 도서관 한 곳. 누르면 찾아가는 데 필요한 정보(주소·전화·홈페이지·운영시간·길찾기)가 펼쳐진다. */
function HoldingItem(props: { entry: FavHolding; isbn13?: string }) {
  const [open, setOpen] = createSignal(false)
  // 운영시간·전화·홈페이지·지도는 평소엔 접어 둔다(청구기호가 먼저 보이게). 소장하지 않는 도서관은 펼친 것 자체가
  // 정보를 달라는 요청이라 바로 보여준다.
  const [infoOpen, setInfoOpen] = createSignal(false)
  const library = () => props.entry.library
  const homepage = () => webUrl(library().homepage)
  const tel = () => telHref(library().tel)
  const maps = () => mapLinks(library())
  // 소장하는 곳만, 펼쳤을 때 한 번 조회한다(도서관마다 요청이 나가므로 미리 부르지 않는다).
  const held = () => props.entry.loan === 'available' || props.entry.loan === 'onLoan'
  const [holding] = createResource(
    () => (open() && held() && props.isbn13 ? props.isbn13 : undefined),
    (isbn) => fetchHolding(isbn, library().libCode),
  )

  return (
    <li
      class={`holdings__item${props.entry.loan === 'notHeld' ? ' holdings__item--dim' : ''}`}
    >
      <button
        class="holdings__summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open()}
      >
        <span class="holdings__info">
          <span class="holdings__name">{library().libName}</span>
          <span class="holdings__addr">{library().address}</span>
        </span>
        <LoanBadge loan={props.entry.loan} />
        <span class="holdings__chevron" aria-hidden>
          <Show when={open()} fallback={<ChevronDown size={14} />}>
            <ChevronUp size={14} />
          </Show>
        </span>
      </button>

      <Show when={open()}>
        <div class="holdings__detail">
          <Show when={held()}>
            <div class="holdings__where">
              <Show
                when={!holding.loading}
                fallback={
                  <span class="inline-loading">
                    <Spinner />
                    청구기호 찾는 중…
                  </span>
                }
              >
                <Show
                  when={!holding.error}
                  fallback={<span>청구기호를 불러오지 못했어요.</span>}
                >
                  <Show
                    when={holding()}
                    fallback={
                      <span>
                        이 도서관이 청구기호를 알려주지 않았어요(2016년 이전에 들어온 책이면 조회되지
                        않아요). 자료실 서가나 도서관 검색대에서 찾아보세요.
                      </span>
                    }
                  >
                    {(info) => (
                      <>
                        <For each={info().copies}>
                          {(copy) => (
                            <p class="holdings__callsign">
                              <span class="holdings__callsign-label">청구기호</span>
                              <strong>{callSignOf(info().classNo, copy) || '—'}</strong>
                              <Show when={copy.location}>
                                <span class="holdings__location">{copy.location}</span>
                              </Show>
                            </p>
                          )}
                        </For>
                        <Show when={info().className}>
                          <p class="holdings__kdc">
                            십진분류 {info().classNo} · {info().className}
                          </p>
                        </Show>
                      </>
                    )}
                  </Show>
                </Show>
              </Show>
            </div>
          </Show>
          <Show when={held()}>
            <button
              class="text-button holdings__info-toggle"
              onClick={() => setInfoOpen((v) => !v)}
              aria-expanded={infoOpen()}
            >
              도서관 정보 {infoOpen() ? '접기' : '보기'}
              <span class="holdings__chevron" aria-hidden>
                <Show when={infoOpen()} fallback={<ChevronDown size={12} />}>
                  <ChevronUp size={12} />
                </Show>
              </span>
            </button>
          </Show>
          <Show when={!held() || infoOpen()}>
            <dl class="holdings__meta">
              <Show when={library().operatingTime}>
                <div>
                  <dt>운영</dt>
                  <dd>{library().operatingTime}</dd>
                </div>
              </Show>
              <Show when={library().closed}>
                <div>
                  <dt>휴관</dt>
                  <dd>{library().closed}</dd>
                </div>
              </Show>
              <Show when={tel()}>
                {(href) => (
                  <div>
                    <dt>전화</dt>
                    <dd>
                      <a href={href()}>{library().tel}</a>
                    </dd>
                  </div>
                )}
              </Show>
            </dl>
            <p class="holdings__links">
              <Show when={homepage()}>
                {(href) => (
                  <a href={href()} target="_blank" rel="noopener noreferrer">
                    홈페이지
                  </a>
                )}
              </Show>
              <a href={maps().map} target="_blank" rel="noopener noreferrer">
                지도
              </a>
              <Show when={maps().route}>
                {(href) => (
                  <a href={href()} target="_blank" rel="noopener noreferrer">
                    길찾기
                  </a>
                )}
              </Show>
            </p>
          </Show>
        </div>
      </Show>
    </li>
  )
}

const LOAN_LABEL: Record<LoanState, string> = {
  loading: '확인 중',
  available: '대출 가능',
  onLoan: '대출 중',
  notHeld: '미소장',
  error: '확인 실패',
}

// switch 문을 컴포넌트 본문에 두면 한 번만 평가되고 굳는다. 표에서 읽는다.
function LoanBadge(props: { loan: LoanState }) {
  const tone = () =>
    props.loan === 'available' ? 'ok' : props.loan === 'onLoan' ? 'warn' : 'muted'
  return (
    <span class={`badge badge--${tone()}`}>
      <Show when={props.loan !== 'loading'} fallback={<Spinner label="확인 중" />}>
        {LOAN_LABEL[props.loan]}
      </Show>
    </span>
  )
}
