interface Props {
  onFile: (file: File) => void
}

/**
 * 알라딘 보관함 파일 불러오기. 보조 기능이다 — 알라딘은 모바일에서 보관함 파일을 내려받을 수 없어서 PC에서
 * 한 번 가져오고, 동기화로 폰에서 쓰는 흐름. 책 추가(검색)가 기본이라 조용한 텍스트 버튼 하나만 둔다.
 */
export function ImportDropzone(props: Props) {
  // Solid의 ref는 변수에 직접 대입된다. .current가 없다.
  let input!: HTMLInputElement

  return (
    <>
      <button
        class="text-button text-button--quiet"
        onClick={() => input.click()}
        title="PC에서 내려받은 알라딘 보관함 파일(xls·csv)을 한꺼번에 가져와요"
      >
        파일 불러오기
      </button>
      <input
        ref={input}
        type="file"
        accept=".xls,.xlsx,.csv,.tsv"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          if (file) props.onFile(file)
          e.currentTarget.value = ''
        }}
      />
    </>
  )
}
