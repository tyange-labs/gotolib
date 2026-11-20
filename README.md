# gotolib

읽고 싶은 책을 담아 두고, 근처 도서관에 그 책이 있는지 찾아가는 PWA. (go to library)

- **서재** — 책을 검색해 담고, 읽은 정도를 기록하고, 찜한다.
- **근처 도서관** — 내 위치 근처 도서관과, 그곳에서 책을 찾아가는 데 필요한 정보(분류번호·청구기호·자료실)를 보여준다.
- **한국문학** — 서버가 YES24 분류에서 모은 17개 출판사의 종이책 목록.
- **계정** — 패스키 로그인, 기기 간 동기화, 찜한 책이 도서관에 들어오면 웹 푸시로 알림.

## 기술 스택

| 영역 | 사용 |
| --- | --- |
| UI | [SolidJS](https://www.solidjs.com), `@solidjs/router`, `@kobalte/core`, `lucide-solid`, `@tyange-labs/design-system` |
| 데이터 | `@tanstack/solid-query`(+ persist), IndexedDB(`idb`), `xlsx` |
| 빌드 | Vite 7, `vite-plugin-pwa`(`autoUpdate`), TypeScript |
| 런타임·패키지 | [bun](https://bun.sh) |
| 린트·변환 | ESLint(`eslint-plugin-solid`), `ast-grep` |

## 시작하기

```sh
bun install
# .env를 만들어 아래 환경 변수를 채운다
bun run dev            # http://localhost:5173
```

`@tyange-labs/design-system`은 `git.tyange.com`에서 받아 오므로 해당 저장소에 접근할 수 있어야 한다.

### 환경 변수 (`.env`, git에 올리지 않음)

| 이름 | 용도 |
| --- | --- |
| `LIBRARY_API_KEY` | 도서관 정보나루(data4library.kr) `authKey` |
| `NL_API_KEY` | 국립중앙도서관 서지정보 API `cert_key` |
| `CMS_API_TARGET` | 계정·동기화·푸시 서버(tyange-cms-api) 주소. 기본값 `http://localhost:8080` |

키는 개발 서버 프록시가 요청에 붙이므로 **클라이언트 번들에는 들어가지 않는다.** 클라이언트는 상대경로만 호출한다.

### 개발 서버 프록시

| 경로 | 대상 |
| --- | --- |
| `/api/library/*` | `data4library.kr` (`authKey`, `format=json` 추가) |
| `/api/seoji/*` | `nl.go.kr` 서지정보 API (`cert_key`, `result_style=json` 추가) |
| `/api/cms/*` | `CMS_API_TARGET` (접두사 제거) |

운영에서는 nginx가 같은 경로를 같은 방식으로 프록시한다.

패스키는 origin이 맞아야 하므로 로컬에서 계정 기능을 쓰려면 로컬 cms-api를 `PASSKEY_RP_ID=localhost`, `PASSKEY_RP_ORIGIN=http://localhost:5173`으로 띄우고 개발 서버 주소(`http://localhost:5173`)로 접속한다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `bun run dev` | 개발 서버 |
| `bun run build` | `tsc -b` 후 프로덕션 빌드 (`dist/`) |
| `bun run preview` | 빌드 결과 미리보기 |
| `bun run lint` | ESLint |
| `bun run test` | `bun test tests` |
| `bun run budget` | `budget.config.json`에 정의한 토큰이 베이스라인(`budget.txt`)보다 늘었는지 검사 |
| `bun run budget:update` | 줄어든 만큼 베이스라인 갱신 |
| `bun run codemod` | `codemod/rules/`의 ast-grep 규칙 검사 (`:review` 대화형, `:apply` 일괄 적용) |

## 프로젝트 구조

```
src/
  main.tsx, router.tsx   진입점, 라우트
  routes/                라우트 컴포넌트 (/, /korean-lit/:genre?, /account, /nearby, /nearby/:libCode)
  views/                 ShelfView, KoreanLitView
  components/            UI 조각 (책 카드·표지, 검색, 페이지네이션, 투어, 푸시 토글 …)
  context/               AppProvider, NearbyProvider
  hooks/                 데이터·상태 훅 (책, 찜, 자주 가는 도서관, 위치 …)
  lib/                   로직 계층 (아래)
  types/                 book, library, novel
public/                  정적 파일, 서비스 워커의 push-handler.js
tests/                   bun 테스트와 API 응답 fixture
scripts/budget.ts        마이그레이션 잔량 검사
codemod/rules/           React → Solid 변환용 ast-grep 규칙
```

### `src/lib`

- **API 클라이언트** — `libraryApi`(정보나루), `novelsApi`(국립중앙도서관), `koreanNovelsApi`·`covers`(tyange-cms-api), `auth`(패스키 세션과 공통 `api()`)
- **저장소** — `db`(IndexedDB: 서재, 찜, 자주 가는 도서관 등), `queries`(TanStack Query 클라이언트와 persist 설정)
- **동기화** — `sync`(받기·합치기·올리기), `syncStore`(저장소 반영), `syncDoc`(합치기 규칙).
  `syncDoc`은 네트워크·IndexedDB를 모르는 순수 함수이며, 항목마다 `at`이 더 늦은 쪽이 이기고(LWW) 삭제는 tombstone으로 남겨 어느 기기에서 어떤 순서로 합쳐도 같은 결과로 수렴한다. 서버는 내용을 해석하지 않고 `version`으로 충돌만 막는다.
- **푸시** — `push`(구독 등록), `pushSupport`(지원 여부 판단). 알림 수신은 `public/push-handler.js`.
- **순수 로직** — `bookSearch`, `holdingInfo`, `novelClassify`, `kdc`, `reading`, `geo` 등. 테스트는 주로 여기에 있다.

표지는 서버가 ISBN으로 찾아 주는 파생 정보라서 `Book`·IndexedDB·동기화 문서에는 넣지 않는다.

## 알아 둘 점

- 정보나루 장서 조회(itemSrch)는 **2016-01-01 이후 등록된 장서만** 반환한다. 그 이전에 들어온 책은 소장 중이어도 조회되지 않는다.
- PWA는 `autoUpdate`다. 새 버전이 배포되면 서비스 워커가 바로 교체되고 `PWABadge`가 새로고침한다.
- Solid에서는 props를 구조 분해하면 반응성이 끊긴다. `budget`의 `solid:props-destructured` 토큰이 이를 잡는다.

## 배포

`main`에 push하면 `.github/workflows/deploy.yml`이 실행된다.

1. `bun install --frozen-lockfile` → `lint` → `test` → `build`
2. `dist/`를 SCP로 `$DEPLOY_PATH/releases/<sha>/`에 올린다.
3. `current` 심볼릭 링크를 새 릴리스로 옮기고 `nginx -t` 후 reload. 롤백을 위해 최근 5개 릴리스만 남긴다.

필요한 설정: Secrets `HOST`, `USERNAME`, `SSH_PRIVATE_KEY`, Variable `DEPLOY_PATH`.
