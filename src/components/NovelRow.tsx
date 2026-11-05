import { Show } from 'solid-js'
import { useApp } from '../context/appContext'
import { yes24ProductUrl } from '../lib/koreanNovelsApi'
import type { KoreanNovel } from '../types/novel'

interface Props {
  novel: KoreanNovel
  /** 전자책도 나와 있는가(NL 서지) */
  hasEbook: boolean
  inShelf: boolean
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
    <li class="search-result">
      <div class="search-result__body">
        <span class="search-result__title">
          {props.novel.title}
          <Show when={props.hasEbook}>
            {' '}
            <span class="badge">전자책</span>
          </Show>
        </span>
        <span class="search-result__meta">
          {[props.novel.author, props.novel.publisher, props.novel.pubMonth?.replace('-', '.')]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <div class="novel-row__actions">
        <a
          class="text-button"
          href={yes24ProductUrl(props.novel.goodsNo)}
          target="_blank"
          rel="noopener noreferrer"
        >
          YES24
        </a>
        <button
          class="text-button"
          classList={{ 'text-button--done': props.inShelf }}
          disabled={props.inShelf}
          onClick={add}
        >
          {props.inShelf ? '담김' : '서재에 담기'}
        </button>
      </div>
    </li>
  )
}
