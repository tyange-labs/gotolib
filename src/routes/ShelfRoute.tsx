import { Show, createEffect, createSignal, on } from 'solid-js'
import { LoadingMessage } from '../components/Spinner'
import { useApp } from '../context/appContext'
import { startTourIfFirstRun } from '../lib/tour'
import { ShelfView } from '../views/ShelfView'

/** '/' — 내 서재: 도서 목록. 파일 불러오기는 목록 머리의 텍스트 버튼(비었을 땐 큰 영역) */
export function ShelfRoute() {
  const {
    books,
    loading,
    error,
    isSample,
    importFile,
    addBook,
    removeBook,
    clearAll,
  } = useApp()
  const [notice, setNotice] = createSignal<string | null>(null)

  // 내 책이 없어 샘플이 보이는 첫 실행이면, 서재가 그려진 뒤 안내를 시작한다.
  createEffect(
    on(
      () => !loading() && isSample(),
      (ready) => {
        if (ready) requestAnimationFrame(() => startTourIfFirstRun())
      },
    ),
  )

  const handleFile = async (file: File) => {
    setNotice(null)
    const result = await importFile(file)
    if (result) setNotice(`${result.imported}권을 불러왔어요.`)
  }

  return (
    <>
      <Show when={error()}>
        {(message) => <p class="message message--error">{message()}</p>}
      </Show>
      <Show when={notice()}>
        {(message) => <p class="message">{message()}</p>}
      </Show>

      <Show when={!loading()} fallback={<LoadingMessage>불러오는 중…</LoadingMessage>}>
        <Show when={isSample()}>
          <p class="sample-note">
            샘플 데이터예요. '책 추가'로 책을 검색해 담으면 내 서재로 바뀝니다.
          </p>
        </Show>
        <ShelfView
          books={books()}
          onRemove={removeBook}
          onClearAll={clearAll}
          onImport={handleFile}
          onAdd={addBook}
        />
      </Show>
    </>
  )
}
