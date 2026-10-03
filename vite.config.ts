import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_ 접두사가 없는 변수까지 읽기 위해 세 번째 인자를 ''로 준다.
  // LIBRARY_API_KEY는 서버측(프록시)에서만 쓰고 클라이언트 번들에는 넣지 않는다.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.LIBRARY_API_KEY ?? ''

  return {
    plugins: [solid(), VitePWA({
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
        // 계정·동기화·패스키(tyange-cms-api). 운영에서는 nginx가 같은 경로를 프록시한다.
        // 패스키는 origin이 맞아야 하므로 로컬 서버는 PASSKEY_RP_ID=localhost,
        // PASSKEY_RP_ORIGIN=http://localhost:5199로 띄운다.
        // 국립중앙도서관 서지정보 API(도서 검색). 키는 .env의 NL_API_KEY(git에 올리지 않음). 운영은 nginx가 같은 일을 한다.
        '/api/seoji': {
          target: 'https://www.nl.go.kr',
          changeOrigin: true,
          rewrite: (path) => {
            const query = path.split('?')[1] ?? ''
            const params = new URLSearchParams(query)
            params.set('cert_key', env.NL_API_KEY ?? '')
            params.set('result_style', 'json')
            return `/seoji/SearchApi.do?${params.toString()}`
          },
        },
        '/api/cms': {
          target: env.CMS_API_TARGET || 'http://localhost:8080',
          rewrite: (path) => path.replace(/^\/api\/cms/, ''),
          // 개발 서버가 계정 API에 못 닿으면(로컬 cms-api가 꺼져 있을 때) 이유를 화면에 보인다. 그냥 두면 이유 없는 500이다.
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if ('writeHead' in res && !res.headersSent) {
                res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
              }
              res.end(
                `계정 서버(${env.CMS_API_TARGET || 'localhost:8080'})에 연결할 수 없어요. 로컬 cms-api를 켜 주세요(패스키는 로컬 서버를 PASSKEY_RP_ID=localhost로 띄워야 해요).`,
              )
            })
          },
        },
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
