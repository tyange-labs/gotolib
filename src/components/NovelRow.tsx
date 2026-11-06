import { Check, Library as ShelfIcon } from 'lucide-solid'
import { Show } from 'solid-js'
import { useApp } from '../context/appContext'
import { yes24ProductUrl } from '../lib/koreanNovelsApi'
import type { KoreanNovel } from '../types/novel'
import { BookCover } from './BookCover'

interface Props {
  novel: KoreanNovel
  /** 전자책도 나와 있는가(NL 서지) */
  hasEbook: boolean
  inShelf: boolean
  /** 서버가 줄여 둔 표지 썸네일 주소(아직 없으면 책 아이콘 칸) */
  coverUrl?: string
}

/** '한국문학' 탭의 책 한 줄: YES24가 장편으로 분류한 종이책. 서재에 담기는 종이책 ISBN 기준. */
export function NovelRow(props: Props) {
  const { addBook } = useApp()

  const add = () => {
    void addBook({
      id: props.novel.id,
      title: props.novel.title,
      author: props.novel.author,
      publisher: props.novel.publisher,
      pubDate: props.novel.pubMonth,
      isbn13: props.novel.id,
      addedAt: Date.now(),
    })
  }

  return (
    <li class="search-result novel-row">
      <BookCover src={props.coverUrl} />
      <div class="search-result__body">
        <span class="search-result__title">
          {props.novel.title}
        </span>
        <span class="search-result__meta">
          {[props.novel.author, props.novel.publisher, props.novel.pubMonth?.replace('-', '.')]
            .filter(Boolean)
            .join(' · ')}
          <Show when={props.hasEbook}>
            {' · '}
            <span class="ebook-mark">전자책</span>
          </Show>
        </span>
      </div>
      <div class="novel-row__actions">
        <a
          class="brand-link"
          href={yes24ProductUrl(props.novel.goodsNo)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`YES24에서 ${props.novel.title} 보기`}
          title="YES24에서 보기"
        >
          <img src="/brands/yes24.ico" alt="" width="20" height="20" />
        </a>
        <button
          class="icon-button"
          disabled={props.inShelf}
          aria-pressed={props.inShelf}
          onClick={add}
          aria-label={`${props.novel.title} ${props.inShelf ? '서재에 담김' : '서재에 담기'}`}
          title={props.inShelf ? '서재에 담겼어요' : '서재에 담기'}
        >
          <Show when={props.inShelf} fallback={<ShelfIcon size={18} />}>
            <Check size={18} />
          </Show>
        </button>
      </div>
    </li>
  )
}
