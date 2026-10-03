/**
 * 도서관 한 곳에서 그 책을 찾아가는 데 필요한 정보(분류번호·청구기호·자료실). 정보나루 도서관별 장서
 * 조회(itemSrch)의 응답을 읽기 좋게 정리하는 순수 함수만 둔다.
 *
 * 한계: 이 API는 2016-01-01 이후 등록된 장서만 조회한다. 그보다 먼저 들어온 책은 소장 중이어도 여기에 없다.
 */

export interface CallNumberCopy {
  /** 별치기호('신착일반', 'EVD' 등). 해당 없으면 undefined */
  shelfMark?: string
  /** 도서기호('김14ㅇ') */
  bookCode?: string
  /** 권차기호 */
  volume?: string
  /** 복본기호 */
  copy?: string
  /** 자료실('가락몰 일반자료실') */
  location?: string
}

export interface HoldingInfo {
  /** 한국십진분류(KDC) 번호 '813.7' */
  classNo?: string
  /** '문학 > 한국문학 > 소설' */
  className?: string
  copies: CallNumberCopy[]
}

export interface ItemDoc {
  class_no?: string
  class_nm?: string
  vol?: string
  callNumbers?: Array<{
    callNumber?: {
      separate_shelf_name?: string
      book_code?: string
      shelf_loc_name?: string
      copy_code?: string
    }
  }>
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** 도서관마다 별치기호 칸에 '적용안함' 같은 자리표시를 넣는다. 의미 없는 값은 뺀다. */
const NO_SHELF_MARK = /^(?:적용안함|해당없음|없음|-)$/

/** 응답의 책 한 건 → 정리한 값. 분류번호도 자료실도 없으면 null. */
export function toHoldingInfo(doc: ItemDoc | undefined): HoldingInfo | null {
  if (!doc) return null
  const classNo = clean(doc.class_no)
  // 'class_nm'은 분류가 비면 ' >  > '처럼 구분자만 남는다.
  const className = clean(doc.class_nm?.replace(/[\s>]+$/g, '').replace(/^[\s>]+/g, ''))
  const copies = (doc.callNumbers ?? []).map(({ callNumber: c }) => {
    const shelfMark = clean(c?.separate_shelf_name)
    return {
      shelfMark: shelfMark && !NO_SHELF_MARK.test(shelfMark) ? shelfMark : undefined,
      bookCode: clean(c?.book_code),
      volume: clean(doc.vol),
      copy: clean(c?.copy_code),
      location: clean(c?.shelf_loc_name),
    }
  })
  if (!classNo && copies.every((c) => !c.bookCode && !c.location)) return null
  return { classNo, className: className || undefined, copies }
}

/** 청구기호: 별치기호 · 분류번호 · 도서기호 · 권차 · 복본 순으로 공백으로 이어 붙인다. '813.7 김14ㅇ' */
export function callSignOf(classNo: string | undefined, copy: CallNumberCopy): string {
  return [
    copy.shelfMark,
    classNo,
    copy.bookCode,
    copy.volume && `v.${copy.volume}`,
    copy.copy && `c.${copy.copy}`,
  ]
    .filter(Boolean)
    .join(' ')
}
