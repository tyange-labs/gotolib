/**
 * 첫 실행 안내(튜토리얼) 상태. 화면은 components/Tour.tsx가 그린다.
 * 마쳤거나 건너뛰었는지는 이 기기의 localStorage에 한 번만 기록한다(기기별 첫 실행).
 */
import { createSignal } from 'solid-js'

const STORAGE_KEY = 'gotolib.tour'

export interface TourStep {
  /** 강조할 요소(document.querySelector) */
  selector: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    selector: '.book-list',
    body: '알라딘 보관함이나 검색으로 담은 책이 이렇게 서재에 쌓여요. 가장 최근에 담은 책이 맨 위예요.',
  },
  {
    selector: '.list-header__actions',
    body: "'책 추가'로 도서관 정보나루에서 제목·저자를 검색해 담고, '불러오기'로 알라딘 보관함 파일(xls, csv)을 한꺼번에 가져와요.",
  },
  {
    selector: '.book-card',
    body: '책을 누르면 자주 가는 도서관의 소장·대출 여부를 볼 수 있고, 하트로 찜 목록에 담아 둘 수 있어요.',
  },
  {
    selector: 'a[href="/nearby"]',
    body: "'도서관' 탭에서 자주 가는 도서관을 등록해 두면, 찜한 책의 대출 가능 여부를 바로 확인해요.",
  },
]

function seen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'done'
  } catch {
    return false // 저장이 막힌 환경에서는 매번 보이지 않게 하려고 이번 세션 안에서만 한 번 보인다
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, 'done')
  } catch {
    // 저장 실패는 무시한다(다음에 한 번 더 보일 뿐이다).
  }
}

const [tourStep, setTourStep] = createSignal<number | null>(null)
/** 이번 실행에서 이미 한 번 자동으로 시작했는지(같은 세션에서 화면을 오가도 다시 뜨지 않게). */
let autoStarted = false

export { tourStep }

/** 첫 실행이면 시작한다. 이미 봤거나 이번 세션에 시작했으면 아무것도 하지 않는다. */
export function startTourIfFirstRun() {
  if (autoStarted || seen()) return
  autoStarted = true
  setTourStep(0)
}

/** 계정 화면의 '사용법 다시 보기': 봤는지와 상관없이 처음부터 보여준다. */
export function replayTour() {
  setTourStep(0)
}

export function nextTourStep() {
  const current = tourStep()
  if (current === null) return
  if (current + 1 >= TOUR_STEPS.length) finishTour()
  else setTourStep(current + 1)
}

/** 마치거나 건너뛴다: 둘 다 '봤음'으로 기록한다. */
export function finishTour() {
  markSeen()
  setTourStep(null)
}
