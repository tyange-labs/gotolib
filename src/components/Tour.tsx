import { Show, createEffect, createSignal, on, onCleanup } from 'solid-js'
import {
  TOUR_STEPS,
  finishTour,
  nextTourStep,
  tourStep,
} from '../lib/tour'

/**
 * 강조할 영역. **문서(페이지) 좌표** 기준이다 — 뷰포트 좌표가 아니다.
 * `vw`·`docH`는 문서 크기, `viewTop`은 지금 화면 맨 위가 문서의 어디인지(설명을 위/아래 어디에 놓을지 정하는 데 쓴다).
 */
interface Box {
  top: number
  left: number
  width: number
  height: number
  vw: number
  vh: number
  docH: number
  viewTop: number
}

/** 대상 둘레의 여백 */
const PAD = 8
const TIP_MAX_WIDTH = 340
const TIP_GAP = 12
const EDGE = 16
/** 단계가 바뀐 뒤 전환 애니메이션을 켜 두는 시간(ms) */
const MOVE_MS = 320
/** 대상이 나타나기를 기다리는 최대 프레임 수(≈0.7초). 화면 전환 직후에 시작하는 경우를 위한 것. */
const MAX_WAIT_FRAMES = 40

const sameBox = (a: Box | null, b: Box) =>
  a !== null &&
  a.top === b.top &&
  a.left === b.left &&
  a.width === b.width &&
  a.height === b.height &&
  a.vw === b.vw &&
  a.vh === b.vh &&
  a.docH === b.docH &&
  a.viewTop === b.viewTop

/**
 * 첫 실행 안내 오버레이. 화면을 흐리게(블러+반투명) 덮고 설명할 영역만 뚫어서 점선으로 강조한다.
 *
 * 왜 페이지 좌표인가: 예전에는 `position: fixed`(뷰포트 기준)로 겹쳤는데, iOS Chrome·Safari는 주소창이
 * 접히고 펼쳐지는 동안 fixed의 기준과 getBoundingClientRect의 기준이 어긋나서 점선이 대상에서 17~19px씩
 * 밀렸다. 오버레이를 문서 안(absolute)에 두고 `rect + 스크롤량`으로 놓으면 뷰포트 상태와 무관하다.
 * 그래도 레이아웃이 중간에 바뀔 수 있어서(글꼴 로딩, 줄바꿈, 주소창) 안내 중에는 매 프레임 다시 잰다.
 *
 * 패널 4개로 구멍을 만드는 이유: backdrop-filter는 구멍을 낼 수 없어서, 구멍 둘레를 네 장으로 덮어야
 * 구멍 안은 선명하게 남고 바깥만 흐려진다. 구멍 위에는 투명한 막이 있어 안내 중에는 아래 화면을 누를 수 없다.
 */
export function Tour() {
  const [box, setBox] = createSignal<Box | null>(null)
  // 단계가 바뀐 직후에만 true: 이때만 새 위치로 부드럽게 이동하고, 그 뒤 따라가기는 즉시 반영한다.
  const [moving, setMoving] = createSignal(false)
  let nextButton: HTMLButtonElement | undefined

  const measure = () => {
    const index = tourStep()
    if (index === null) return
    const target = document.querySelector(TOUR_STEPS[index].selector)
    if (!target) return
    const r = target.getBoundingClientRect()
    const next: Box = {
      top: Math.round(r.top + window.scrollY - PAD),
      left: Math.round(r.left + window.scrollX - PAD),
      width: Math.round(r.width + PAD * 2),
      height: Math.round(r.height + PAD * 2),
      vw: document.documentElement.clientWidth,
      vh: window.innerHeight,
      docH: Math.max(document.documentElement.scrollHeight, window.innerHeight),
      viewTop: Math.round(window.scrollY),
    }
    if (!sameBox(box(), next)) setBox(next)
  }

  // 단계가 바뀌면 대상을 찾아(화면 전환 직후면 잠깐 기다려) 화면에 보이게 하고 측정한다.
  createEffect(
    on(tourStep, (index) => {
      // 끝났을 때만 비운다. 단계가 바뀌는 동안에는 이전 영역을 그대로 두어서 오버레이가 깜빡이지 않고,
      // 새 위치를 재면 그쪽으로 부드럽게 옮겨 간다(CSS transition).
      if (index === null) {
        setBox(null)
        return
      }
      setMoving(true)
      const settle = setTimeout(() => setMoving(false), MOVE_MS)
      let cancelled = false
      let frames = 0
      const find = () => {
        if (cancelled) return
        const target = document.querySelector(TOUR_STEPS[index].selector)
        if (target) {
          target.scrollIntoView({ block: 'center' })
          requestAnimationFrame(() => {
            if (cancelled) return
            measure()
            nextButton?.focus({ preventScroll: true })
          })
          return
        }
        // 오래 기다려도 대상이 없으면 이 단계는 건너뛴다(다 건너뛰면 안내가 끝난다).
        if (++frames > MAX_WAIT_FRAMES) nextTourStep()
        else requestAnimationFrame(find)
      }
      find()
      onCleanup(() => {
        cancelled = true
        clearTimeout(settle)
      })
    }),
  )

  // 안내 중에는 매 프레임 위치를 다시 재서 대상을 따라간다(바뀐 게 없으면 아무것도 하지 않는다).
  // Esc는 건너뛰기. 화면 스크롤은 막지 않는다 — iOS에서 body overflow:hidden이 레이아웃을 흔든다.
  createEffect(() => {
    if (tourStep() === null) return
    let raf = 0
    const track = () => {
      measure()
      raf = requestAnimationFrame(track)
    }
    raf = requestAnimationFrame(track)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishTour()
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
    })
  })

  const px = (n: number) => `${Math.max(0, Math.round(n))}px`

  return (
    <Show when={tourStep() !== null && box()}>
      {(b) => {
        const hole = () => ({
          top: px(b().top),
          left: px(b().left),
          width: px(b().width),
          height: px(b().height),
        })
        const bottom = () => b().top + b().height
        const right = () => b().left + b().width
        const tipWidth = () => Math.min(TIP_MAX_WIDTH, b().vw - EDGE * 2)
        // 지금 화면에서 대상이 위쪽에 있으면 아래에, 아래쪽에 있으면 위에 설명을 놓는다.
        // 위에 놓을 때는 키(높이)를 몰라도 되게 translateY(-100%)로 끌어올린다.
        const tipStyle = () => {
          const onScreenBottom = bottom() - b().viewTop
          const below = onScreenBottom < b().vh * 0.6
          const left = Math.min(Math.max(b().left, EDGE), b().vw - tipWidth() - EDGE)
          return below
            ? { left: px(left), width: px(tipWidth()), top: px(bottom() + TIP_GAP) }
            : {
                left: px(left),
                width: px(tipWidth()),
                top: px(b().top - TIP_GAP),
                transform: 'translateY(-100%)',
              }
        }
        const index = () => tourStep() ?? 0
        const isLast = () => index() === TOUR_STEPS.length - 1

        return (
          <div
            classList={{ tour: true, 'tour--moving': moving() }}
            style={{ height: px(b().docH) }}
            role="dialog"
            aria-modal="true"
            aria-label="사용법 안내"
          >
            <div class="tour__shade" style={{ top: 0, left: 0, width: '100%', height: px(b().top) }} />
            <div
              class="tour__shade"
              style={{ top: px(bottom()), left: 0, width: '100%', height: px(b().docH - bottom()) }}
            />
            <div
              class="tour__shade"
              style={{ top: px(b().top), left: 0, width: px(b().left), height: px(b().height) }}
            />
            <div
              class="tour__shade"
              style={{ top: px(b().top), left: px(right()), width: px(b().vw - right()), height: px(b().height) }}
            />
            <div class="tour__block" style={hole()} />
            <div class="tour__focus" style={hole()} />

            <div class="tour__tip" style={tipStyle()}>
              <p class="tour__body">{TOUR_STEPS[index()].body}</p>
              <div class="tour__actions">
                <span class="tour__count">
                  {index() + 1} / {TOUR_STEPS.length}
                </span>
                <button class="text-button" onClick={() => finishTour()}>
                  건너뛰기
                </button>
                <button
                  class="primary-button"
                  ref={nextButton}
                  onClick={() => nextTourStep()}
                >
                  {isLast() ? '시작하기' : '다음'}
                </button>
              </div>
            </div>
          </div>
        )
      }}
    </Show>
  )
}
