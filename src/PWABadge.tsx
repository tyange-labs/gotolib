import { createEffect } from 'solid-js'

import { useRegisterSW } from 'virtual:pwa-register/solid'

/**
 * 새 배포를 자동으로 받는다(사용자 결정, 2026-11) — registerType: 'autoUpdate'와 짝이다.
 * 예전엔 needRefresh일 때 토스트를 띄워 사용자가 "Reload"를 직접 눌러야 했는데, 그걸 놓치면(또는
 * 탭만 닫고 완전히 끄지 않으면) 홈 화면 앱이 계속 예전 번들을 보여주는 문제가 있었다. 혼자 쓰는 앱이라
 * 화면이 쓰는 도중 한 번 새로고침되는 쪽이 "업데이트가 전혀 안 먹는" 쪽보다 낫다는 판단.
 */
function PWABadge() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  createEffect(() => {
    if (needRefresh()) void updateServiceWorker(true)
  })

  return null
}

export default PWABadge
