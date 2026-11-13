import { lang, tr } from './i18n'
import list from '../data/avatars.json'

/** Набор аватарок fasol: id хранится на сервере, картинка — в статике /avatars/<id>.webp */
export type AvatarItem = { id: string; name: string; nameEn: string; collection: string }
export const AVATARS = list as AvatarItem[]
export const avatarSrc = (id: string) => `/avatars/${id}.webp`
export const avatarName = (a: AvatarItem) => (lang === 'en' ? a.nameEn : a.name) + (a.collection === 'musical' ? tr(' с нотами') : '')
