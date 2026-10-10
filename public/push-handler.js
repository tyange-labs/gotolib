// gotolib 서비스 워커에 얹는 웹 푸시 처리(vite.config.ts의 workbox.importScripts로 불러온다).
// 서버(tyange-cms-api)가 보내는 본문은 JSON { title, body, url, tag }다.
// 보이지 않는 푸시는 허용되지 않으므로(userVisibleOnly) 받으면 반드시 알림을 띄운다.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'gotolib'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      // 같은 tag의 알림은 겹쳐 쌓이지 않고 갈아 끼워진다(같은 책의 알림이 두 번 쌓이지 않게).
      tag: data.tag || undefined,
      icon: '/pwa-192x192.png',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        // 이미 열려 있는 앱이 있으면 새 창을 만들지 않고 그 창을 앞으로 가져온다.
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(url)
            } catch {
              // 다른 출처이거나 제어할 수 없는 창이면 포커스만 한다.
            }
          }
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
