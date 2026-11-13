import { lang, tr } from '../lib/i18n'
import list from '../data/avatars.json'
import type { User } from '../lib/account'

/** Набор аватарок fasol: id хранится на сервере, картинка — в статике /avatars/<id>.webp */
export type AvatarItem = { id: string; name: string; nameEn: string; collection: string }
export const AVATARS = list as AvatarItem[]
export const avatarSrc = (id: string) => `/avatars/${id}.webp`
export const avatarName = (a: AvatarItem) => (lang === 'en' ? a.nameEn : a.name) + (a.collection === 'musical' ? tr(' с нотами') : '')

/** Аватар пользователя: выбранный из набора → фото из Google/Яндекса → первая буква имени */
export function UserAvatar({ user, size = 56 }: { user: User; size?: number }) {
  const st = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (user.avatarId) return <img src={avatarSrc(user.avatarId)} alt="" className="avatar pack" style={st} width={size} height={size} />
  if (user.avatar) return <img src={user.avatar} alt="" className="avatar" style={st} referrerPolicy="no-referrer" />
  return <span className="avatar" style={st} aria-hidden>{(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}</span>
}
