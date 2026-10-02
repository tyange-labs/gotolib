import { Show, createEffect, createSignal, on, onCleanup } from 'solid-js'
import {
  TOUR_STEPS,
  finishTour,
  nextTourStep,
  tourStep,
} from '../lib/tour'

/** 강조할 영역(뷰포트 기준)과 뷰포트 크기 */
interface Box {
  top: number
  left: number
  width: number
  height: number
  vw: number
  vh: number
}

/** 대상 둘레의 여백 */
const PAD = 8
const TIP_MAX_WIDTH = 340
const TIP_GAP = 12
const EDGE = 16
/** 대상이 나타나기를 기다리는 최대 프레임 수(≈0.7초). 화면 전환 직후에 시작하는 경우를 위한 것. */
const MAX_WAIT_FRAMES = 40

/**
 * 첫 실행 안내 오버레이. 화면을 흐리게(블러+반투명) 덮고 설명할 영역만 뚫어서 점선으로 강조한다.
 * 패널 4개로 구멍을 만드는 이유: backdrop-filter는 구멍을 낼 수 없어서, 구멍 둘레를 네 장으로 덮어야
 * 구멍 안은 선명하게 남고 바깥만 흐려진다. 구멍 위에는 투명한 막이 있어 안내 중에는 아래 화면을 누를 수 없다.
 */
export function Tour() {
  const [box, setBox] = createSignal<Box | null>(null)
  let nextButton: HTMLButtonElement | undefined

  const measure = () => {
    const index = tourStep()
    if (index === null) return
    const target = document.querySelector(TOUR_STEPS[index].selector)
    if (!target) return
    const r = target.getBoundingClientRect()
    setBox({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
      vw: window.innerWidth,
      vh: window.innerHeight,
    })
  }

  // 단계가 바뀌면 대상을 찾아(화면 전환 직후면 잠깐 기다려) 가운데로 가져오고 측정한다.
  createEffect(
    on(tourStep, (index) => {
      // 끝났을 때만 비운다. 단계가 바뀌는 동안에는 이전 영역을 그대로 두어서 오버레이가 깜빡이지 않고,
      // 새 위치를 재면 그쪽으로 부드럽게 옮겨 간다(CSS transition).
      if (index === null) {
        setBox(null)
        return
      }
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
            nextButton?.focus()
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
      })
    }),
  )

  // 안내 중에는 화면이 스크롤되지 않게 잠그고, 크기가 바뀌면 다시 잰다. Esc는 건너뛰기.
  createEffect(() => {
    if (tourStep() === null) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishTour()
    }
    window.addEventListener('resize', measure)
    window.addEventListener('keydown', onKey)
    onCleanup(() => {
      document.body.style.overflow = previous
      window.removeEventListener('resize', measure)
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
        // 대상이 화면 위쪽에 있으면 아래에, 아래쪽에 있으면 위에 설명을 놓는다.
        const tipStyle = () => {
          const below = bottom() < b().vh * 0.6
          const left = Math.min(Math.max(b().left, EDGE), b().vw - tipWidth() - EDGE)
          return below
            ? { left: px(left), width: px(tipWidth()), top: px(bottom() + TIP_GAP) }
            : {
                left: px(left),
                width: px(tipWidth()),
                bottom: px(b().vh - b().top + TIP_GAP),
              }
        }
        const index = () => tourStep() ?? 0
        const isLast = () => index() === TOUR_STEPS.length - 1

        return (
          <div class="tour" role="dialog" aria-modal="true" aria-label="사용법 안내">
            <div class="tour__shade" style={{ top: 0, left: 0, width: '100%', height: px(b().top) }} />
            <div
              class="tour__shade"
              style={{ top: px(bottom()), left: 0, width: '100%', height: px(b().vh - bottom()) }}
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
