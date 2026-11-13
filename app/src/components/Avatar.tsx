import { avatarSrc } from '../lib/avatars'
import type { User } from '../lib/account'

/** Аватар пользователя: выбранный из набора → фото из Google/Яндекса → первая буква имени */
export function UserAvatar({ user, size = 56 }: { user: User; size?: number }) {
  const st = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (user.avatarId) return <img src={avatarSrc(user.avatarId)} alt="" className="avatar pack" style={st} width={size} height={size} />
  if (user.avatar) return <img src={user.avatar} alt="" className="avatar" style={st} referrerPolicy="no-referrer" />
  return <span className="avatar" style={st} aria-hidden>{(user.name ?? user.email ?? '?').slice(0, 1).toUpperCase()}</span>
}
