import { Star } from 'lucide-react'
import { useApp } from '../context/appContext'
import type { Library } from '../lib/libraryApi'

/** 자주 가는 도서관 추가/제거 토글 (★/☆) */
export function FavoriteStar({ library }: { library: Library }) {
  const { favorites } = useApp()
  const active = favorites.isFavorite(library.libCode)

  return (
    <button
      type="button"
      className={`fav-star${active ? ' fav-star--active' : ''}`}
      aria-pressed={active}
      aria-label={
        active ? '자주 가는 도서관에서 제거' : '자주 가는 도서관에 추가'
      }
      title={active ? '자주 가는 도서관에서 제거' : '자주 가는 도서관에 추가'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        favorites.toggle(library)
      }}
    >
      <Star size={18} fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}
