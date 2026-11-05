import { createQuery } from '@tanstack/solid-query'
import { createMemo } from 'solid-js'
import { useApp } from '../context/appContext'
import type { BookInfoEntry } from '../lib/bookInfo'
import { aladinProductUrl, classifyWithAladin } from '../lib/novelClassify'
import { pageCountQuery } from '../lib/queries'
import type { NovelCandidate, NovelVerdict } from '../types/novel'

interface Props {
  novel: NovelCandidate
  inShelf: boolean
  /** 알라딘에서 뽑은 분류·형식어·쪽수(있으면 NL 서지 추정보다 우선한다) */
  aladin?: BookInfoEntry
}

const VERDICT_BADGE: Record<NovelVerdict, string> = {
  장편: 'badge--ok',
  소설집: 'badge--warn',
  '확인 필요': 'badge--warn',
  '소설 아님': 'badge--warn',
}

/**
 * '한국문학' 탭의 책 한 줄. 쪽수는 화면에 보이지 않지만 장편/소설집 판정에는 여전히 쓴다(보일 때
 * 종이책 ISBN으로 조회, 받으면 판정을 다시 한다). 서재에 담기·알라딘 링크는 novel.id(단행본 ISBN 우선) 기준.
 */
export function NovelRow(props: Props) {
  const { addBook } = useApp()
  // 알라딘이 이미 쪽수를 찾아줬으면(book-info) NL 서지 쪽수 조회는 건너뛴다.
  const pageCount = createQuery(() => ({
    ...pageCountQuery(props.novel.paperIsbn13 ?? ''),
    enabled: !!props.novel.paperIsbn13 && props.aladin?.pages == null,
  }))

  const verdict = createMemo<NovelVerdict>(() =>
    classifyWithAladin(props.novel, pageCount.data, props.aladin),
  )

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
          {props.novel.title}{' '}
          <span class="badge" classList={{ [VERDICT_BADGE[verdict()]]: true }}>
            {verdict()}
          </span>{' '}
          <span class="badge">전자책</span>
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
