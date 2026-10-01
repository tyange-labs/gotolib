/**
 * 저장소 변경 알림. 두 종류를 구분한다:
 * - local: 사용자가 이 기기에서 바꿨다 → 동기화를 예약해야 한다
 * - applied: 동기화가 다른 기기의 변경을 이 기기에 반영했다 → 화면이 다시 읽어야 한다
 * 둘을 합치면 '반영 → 변경으로 오인 → 다시 동기화'로 무한히 돈다.
 */
type Listener = () => void

const local = new Set<Listener>()
const applied = new Set<Listener>()

function subscribe(set: Set<Listener>, listener: Listener) {
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

export const onLocalChange = (listener: Listener) => subscribe(local, listener)
export const emitLocalChange = () => local.forEach((listener) => listener())

export const onDataApplied = (listener: Listener) => subscribe(applied, listener)
export const emitDataApplied = () => applied.forEach((listener) => listener())
