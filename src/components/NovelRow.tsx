import { createQuery } from '@tanstack/solid-query'
import { createMemo } from 'solid-js'
import { useApp } from '../context/appContext'
import { aladinProductUrl, classifyNovel } from '../lib/novelClassify'
import { pageCountQuery } from '../lib/queries'
import type { NovelCandidate, NovelVerdict } from '../types/novel'

interface Props {
  novel: NovelCandidate
  inShelf: boolean
}

const VERDICT_BADGE: Record<NovelVerdict, string> = {
  장편: 'badge--ok',
  '소설집·중편': 'badge--warn',
  '확인 필요': 'badge--warn',
  '소설 아님': 'badge--warn',
}

/** '한국문학' 탭의 책 한 줄: 쪽수는 보일 때 종이책 ISBN으로 조회하고, 받으면 장편/소설집 판정을 다시 한다. */
export function NovelRow(props: Props) {
  const { addBook } = useApp()
  const pageCount = createQuery(() => ({
    ...pageCountQuery(props.novel.paperIsbn13 ?? ''),
    enabled: !!props.novel.paperIsbn13,
  }))

  const verdict = createMemo<NovelVerdict>(() => classifyNovel(props.novel, pageCount.data))

  const add = () => {
    void addBook({
      id: props.novel.ebookIsbn13,
      title: props.novel.title,
      author: props.novel.author,
      publisher: props.novel.publisher,
      pubDate: props.novel.pubDate,
      isbn13: props.novel.ebookIsbn13,
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
          </span>
        </span>
        <span class="search-result__meta" aria-busy={pageCount.isPending}>
          {[
            props.novel.author,
            props.novel.publisher,
            props.novel.pubDate?.slice(0, 4),
            pageCount.data ? `${pageCount.data}쪽` : props.novel.paperIsbn13 ? undefined : '쪽수 미상',
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <div class="novel-row__actions">
        <a
          class="text-button"
          href={aladinProductUrl(props.novel.ebookIsbn13)}
          target="_blank"
          rel="noopener noreferrer"
        >
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
