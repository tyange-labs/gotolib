import type { Book } from '../types/book'

/**
 * 처음 쓰는 사람에게 보여주는 샘플 4권(첫 실행 안내에서 하나씩 담기는 책들).
 * 도서관 정보나루 도서 검색에서 가져온 실제 서지 정보라서 '도서관 찾기'도 그대로 동작한다.
 * 순서가 곧 화면 순서다(담은 시각은 의미 없음). 개인 목록이 아니다.
 */
export const SAMPLE_BOOKS: Book[] = [
  {
    id: '9788932027265',
    title: '사람, 장소, 환대',
    author: '김현경 지음',
    publisher: '문학과지성사',
    pubDate: '2015',
    isbn13: '9788932027265',
    kdc: '3',
    addedAt: 0,
  },
  {
    id: '9788934956051',
    title: '멀티 유니버스',
    author: '브라이언 그린, 박병철 옮김',
    publisher: '김영사',
    pubDate: '2011',
    isbn13: '9788934956051',
    kdc: '4',
    addedAt: 0,
  },
  {
    id: '9788932014586',
    title: '따뜻한 흙',
    author: '조은 지음',
    publisher: '문학과지성사',
    pubDate: '2003',
    isbn13: '9788932014586',
    kdc: '8',
    addedAt: 0,
  },
  {
    id: '9788954602785',
    title: '푸르른 틈새',
    author: '권여선',
    publisher: '문학동네',
    pubDate: '2007',
    isbn13: '9788954602785',
    kdc: '8',
    addedAt: 0,
  },
]
