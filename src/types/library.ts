export interface Library {
  libCode: string
  libName: string
  address: string
  tel: string
  latitude: number
  longitude: number
  homepage: string
  closed: string
  operatingTime: string
  /** 장서 수 (libSrch 응답에만 존재) */
  bookCount?: number
}
