import { Book } from 'lucide-solid'
import { Show, createSignal, on, createEffect } from 'solid-js'

interface Props {
  /** 표지 썸네일 주소. 없거나 못 불러오면 책 아이콘 칸을 보인다 */
  src?: string
}

/**
 * 책 표지 칸. 표지가 있든 없든 같은 크기를 차지해서 이미지가 늦게 도착해도 목록이 밀리지 않는다.
 * 표지는 장식이라 alt는 비워 둔다(책 정보는 옆의 글자에 있다). 표지가 없을 땐 글자 대신 책 아이콘을 둔다..
 */
export function BookCover(props: Props) {
  const [failed, setFailed] = createSignal(false)
  // 주소가 바뀌면(다른 책으로 재사용되는 칸) 실패 기록을 지운다.
  createEffect(
    on(
      () => props.src,
      () => setFailed(false),
    ),
  )

  return (
    <span class="book-cover" aria-hidden="true">
      <Show
        when={props.src && !failed()}
        fallback={
          <span class="book-cover__tile">
            <Book size={20} strokeWidth={1.5} aria-hidden />
          </span>
        }
      >
        <img
          class="book-cover__img"
          src={props.src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </Show>
    </span>
  )
}
