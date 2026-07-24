import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_ 접두사가 없는 변수까지 읽기 위해 세 번째 인자를 ''로 준다.
  // LIBRARY_API_KEY는 서버측(프록시)에서만 쓰고 클라이언트 번들에는 넣지 않는다.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.LIBRARY_API_KEY ?? ''

  return {
    plugins: [react(), VitePWA({
      registerType: 'prompt',
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: 'gotolib',
        short_name: 'gotolib',
        description: 'go to library',
        theme_color: '#ffffff',
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },

      devOptions: {
        enabled: false,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
    })],

    // 클라이언트는 /api/library/* 상대경로만 호출한다.
    // 이 프록시가 data4library.kr로 넘기면서 authKey와 format을 붙인다.
    // 배포 시에는 tyange-cms-api가 동일한 역할(키 주입)을 맡으면 클라 코드는 그대로다.
    server: {
      proxy: {
        '/api/library': {
          target: 'https://data4library.kr',
          changeOrigin: true,
          rewrite: (path) => {
            const [pathname, query = ''] = path
              .replace(/^\/api\/library/, '/api')
              .split('?')
            const params = new URLSearchParams(query)
            params.set('authKey', apiKey)
            params.set('format', 'json')
            return `${pathname}?${params.toString()}`
          },
        },
      },
    },
  }
})
