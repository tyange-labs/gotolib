import { Show, createSignal } from 'solid-js'
import { ImportDropzone } from '../components/ImportDropzone'
import { useApp } from '../context/appContext'
import { ShelfView } from '../views/ShelfView'

/** '/' — 내 서재: 파일 가져오기 + 도서 목록 */
export function ShelfRoute() {
  const { books, loading, error, isSample, importFile, removeBook, clearAll } =
    useApp()
  const [notice, setNotice] = createSignal<string | null>(null)

  const handleFile = async (file: File) => {
    setNotice(null)
    const result = await importFile(file)
    if (result) setNotice(`${result.imported}권을 불러왔습니다.`)
  }

  return (
    <>
      <Show when={isSample()}>
        <p class="sample-banner">
          👋 <strong>샘플 데이터</strong>로 둘러보는 중이에요. 알라딘 보관함
          파일을 올리면 내 목록으로 바뀝니다.
        </p>
      </Show>

      <ImportDropzone onFile={handleFile} />

      <Show when={error()}>
        {(message) => <p class="message message--error">{message()}</p>}
      </Show>
      <Show when={notice()}>
        {(message) => <p class="message message--notice">{message()}</p>}
      </Show>

      <Show
        when={!loading()}
        fallback={<p class="message">불러오는 중…</p>}
      >
        <Show
          when={books().length > 0}
          fallback={
            <p class="message">
              아직 저장된 책이 없어요. 알라딘 보관함 파일을 불러와보세요.
            </p>
          }
        >
          <ShelfView books={books} onRemove={removeBook} onClearAll={clearAll} />
        </Show>
      </Show>
    </>
  )
}
