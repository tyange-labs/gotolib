import { useApp } from '../context/appContext'
import { aladinProductUrl } from '../lib/novelClassify'
import type { NovelCandidate } from '../types/novel'

interface Props {
  novel: NovelCandidate
  inShelf: boolean
}

/**
 * '한국문학' 탭의 책 한 줄(목록에는 YES24가 장편으로 분류한 책만 온다). 서재에 담기·알라딘 링크는
 * novel.id(단행본 ISBN 우선) 기준.
 */
export function NovelRow(props: Props) {
  const { addBook } = useApp()

  const add = () => {
    // novel.id는 단행본(종이책) ISBN 우선 — 서재의 책도 그 기준을 따른다(알라딘 표지도 그쪽이 더 잘 잡힌다).
    void addBook({
      id: props.novel.id,
      title: props.novel.title,
      author: props.novel.author,
      publisher: props.novel.publisher,
      pubDate: props.novel.pubDate,
      isbn13: props.novel.id,
      price: props.novel.price,
      addedAt: Date.now(),
    })
  }

  return (
    <li class="search-result">
      <div class="search-result__body">
        <span class="search-result__title">
          {props.novel.title} <span class="badge">전자책</span>
        </span>
        <span class="search-result__meta">
          {[props.novel.author, props.novel.publisher, props.novel.pubDate?.slice(0, 4)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <div class="novel-row__actions">
        <a class="text-button" href={aladinProductUrl(props.novel.id)} target="_blank" rel="noopener noreferrer">
          알라딘
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
