/**
 * ISBN이 없는 책의 id: 제목+저자 기반 해시. 가져오기(parseAladin)와 검색(bookSearch)이 같이 쓴다.
 * 같은 책을 같은 입력으로 다시 만나면 같은 id가 나와야 한다.
 */
export function fallbackId(title: string, author?: string): string {
  const source = `${title}|${author ?? ''}`
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0
  }
  return `local-${(hash >>> 0).toString(36)}`
}
