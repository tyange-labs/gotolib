/**
 * 도서관을 찾아가는 데 쓰는 링크. 정보나루가 주는 값을 그대로 믿지 않고, 열 수 없는 값은 링크로 만들지 않는다.
 */
import type { Library } from '../types/library'

/** 홈페이지 주소를 열 수 있는 http(s) 주소로. 스킴이 없으면 http://를 붙이고, 이상하면 undefined. */
export function webUrl(raw: string | undefined): string | undefined {
  const text = raw?.trim()
  if (!text || text === '-') return undefined
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

/** 전화번호를 tel: 링크로. 숫자·+·-·괄호·공백만 허용한다. */
export function telHref(raw: string | undefined): string | undefined {
  const text = raw?.trim()
  if (!text || text === '-' || !/^[\d+\-()\s]+$/.test(text)) return undefined
  return `tel:${text.replace(/[^\d+]/g, '')}`
}

const validCoords = (lib: Pick<Library, 'latitude' | 'longitude'>) =>
  Number.isFinite(lib.latitude) &&
  Number.isFinite(lib.longitude) &&
  Math.abs(lib.latitude) > 1 &&
  Math.abs(lib.longitude) > 1

/** 카카오맵에서 도서관 위치 보기 / 길찾기. 좌표가 없으면 도서관 이름 검색으로. */
export function mapLinks(lib: Library): { map: string; route?: string } {
  const name = encodeURIComponent(lib.libName)
  if (!validCoords(lib)) return { map: `https://map.kakao.com/?q=${name}` }
  const at = `${name},${lib.latitude},${lib.longitude}`
  return {
    map: `https://map.kakao.com/link/map/${at}`,
    route: `https://map.kakao.com/link/to/${at}`,
  }
}
