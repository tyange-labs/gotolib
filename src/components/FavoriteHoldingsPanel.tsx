import { A } from '@solidjs/router'
import { For, Show } from 'solid-js'
import type { FavHolding, LoanState } from '../hooks/useFavoriteHoldings'

interface Props {
  holdings: FavHolding[] | null
  favoritesCount: number
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
                {(entry) => (
                  <li
                    class={`holdings__item${
                      entry.loan === 'notHeld' ? ' holdings__item--dim' : ''
                    }`}
                  >
                    <div class="holdings__info">
                      <span class="holdings__name">{entry.library.libName}</span>
                      <span class="holdings__addr">{entry.library.address}</span>
                    </div>
                    <LoanBadge loan={entry.loan} />
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </Show>
    </Show>
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
  return <span class={`badge badge--${tone()}`}>{LOAN_LABEL[props.loan]}</span>
}
