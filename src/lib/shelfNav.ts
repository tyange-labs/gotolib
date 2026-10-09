import { createSignal } from 'solid-js'

/**
 * 상단 내비게이션의 '서재'를 눌렀다는 신호. 이미 서재 화면에 있으면 라우트가 바뀌지 않아서 화면이 알 길이 없으니,
 * 눌릴 때마다 숫자를 올려 서재 화면이 첫 쪽으로 돌아가게 한다(다른 화면에서 오는 경우는 어차피 1쪽으로 시작한다).
 */
const [shelfHomeRequests, setShelfHomeRequests] = createSignal(0)
export { shelfHomeRequests }
export const requestShelfHome = () => setShelfHomeRequests((n) => n + 1)
