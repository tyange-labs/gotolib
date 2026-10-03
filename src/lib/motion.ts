/**
 * 찜하기·찜 풀기 전환 애니메이션. 상태(저장소)는 애니메이션이 끝난 뒤에 바꾼다 — 그래야 요소가 사라지는
 * 모습이 보인다. 모션 줄이기 설정이거나 애니메이션을 못 쓰면 바로 끝난다.
 */

/** 애니메이션이 멈추거나(백그라운드 탭 등) 끝 이벤트를 놓쳐도 이 시간 안에는 반드시 돌아온다. */
const SAFETY_MS = 900

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const settled = (animations: Animation[]) =>
  Promise.race([
    Promise.all(animations.map((a) => a.finished.catch(() => undefined))),
    new Promise((resolve) => setTimeout(resolve, SAFETY_MS)),
  ])

/** 목표로 날아갈 곳: 찜 목록 머리(없으면 그 자리를 잡는 빈 표지). 화면 위로 벗어났으면 화면 맨 위로 맞춘다. */
function watchTarget(): DOMRect | null {
  const target = document.querySelector('[data-watch-target]')
  if (!target) return null
  const rect = target.getBoundingClientRect()
  return rect
}

/**
 * 서재의 카드가 찜 목록으로 날아가며 사라지는 효과: 제목 조각이 찜 목록 머리로 줄어들며 날아가고,
 * 카드는 제자리에서 접힌다. 카드는 접힌 채로 남으니(fill: forwards) 호출한 쪽이 상태를 바꾸면 사라지고,
 * 실패하면 `restore()`로 되돌린다.
 */
export async function flyToWatchlist(card: HTMLElement): Promise<{ restore: () => void }> {
  const restore = () => card.getAnimations().forEach((a) => a.cancel())
  if (reducedMotion() || typeof card.animate !== 'function') return { restore }

  const animations: Animation[] = []
  const rect = card.getBoundingClientRect()
  const title = card.querySelector('.book-card__title')?.textContent ?? ''
  const target = watchTarget()

  // 날아가는 조각은 문서 좌표의 absolute로 둔다(iOS에서 fixed와 getBoundingClientRect가 어긋나는 일을 피한다).
  if (target) {
    const ghost = document.createElement('div')
    ghost.className = 'fly-ghost'
    ghost.textContent = title
    ghost.style.left = `${rect.left + scrollX}px`
    ghost.style.top = `${rect.top + scrollY}px`
    ghost.style.maxWidth = `${rect.width}px`
    document.body.append(ghost)

    const fromX = rect.left
    const fromY = rect.top
    const toX = target.left + 12
    const toY = Math.max(target.top, 16)
    const fly = ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 0.95 },
        {
          transform: `translate(${toX - fromX}px, ${toY - fromY}px) scale(0.25)`,
          opacity: 0.1,
        },
      ],
      { duration: 520, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
    )
    animations.push(fly)
    void fly.finished.finally(() => ghost.remove()).catch(() => ghost.remove())
    setTimeout(() => ghost.remove(), SAFETY_MS + 200)
  }

  // 카드는 접히며 사라진다.
  card.style.overflow = 'hidden'
  animations.push(
    card.animate(
      [
        { height: `${rect.height}px`, opacity: 1 },
        { height: `${rect.height}px`, opacity: 0, offset: 0.5 },
        { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', borderBottomWidth: '0px' },
      ],
      { duration: 520, easing: 'ease', fill: 'forwards' },
    ),
  )

  await settled(animations)
  return { restore }
}

/** 찜 목록에서 풀 때: 그 자리에서 흐려지며 접힌다(날아가지 않는다). */
export async function fadeOut(row: HTMLElement): Promise<{ restore: () => void }> {
  const restore = () => row.getAnimations().forEach((a) => a.cancel())
  if (reducedMotion() || typeof row.animate !== 'function') return { restore }
  const height = row.getBoundingClientRect().height
  row.style.overflow = 'hidden'
  await settled([
    row.animate(
      [
        { height: `${height}px`, opacity: 1 },
        { height: `${height}px`, opacity: 0, offset: 0.6 },
        { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px' },
      ],
      { duration: 260, easing: 'ease', fill: 'forwards' },
    ),
  ])
  return { restore }
}
