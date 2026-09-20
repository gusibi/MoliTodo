import {
  Book,
  Bookmark,
  Briefcase,
  Calendar,
  Clock,
  Flag,
  Folder,
  Heart,
  Home,
  Inbox,
  List,
  Music,
  Star,
  Target,
  Trophy,
  User
} from '@lucide/vue'

/**
 * 清单图标映射：持久化名称 -> 本地 Lucide 组件。
 *
 * - 只包含实际使用的图标，避免为动态名称导入整套图标。
 * - 未识别名称由调用方回退到默认图标，不崩溃、不改写用户数据。
 * - 图标选择器与清单展示共用此映射。
 */
export const LIST_ICONS = {
  list: List,
  inbox: Inbox,
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  flag: Flag,
  folder: Folder,
  briefcase: Briefcase,
  home: Home,
  user: User,
  calendar: Calendar,
  clock: Clock,
  target: Target,
  trophy: Trophy,
  book: Book,
  music: Music
}

export const LIST_ICON_NAMES = Object.keys(LIST_ICONS)

/**
 * 解析清单图标名称，未识别时回退默认图标；不抛错、不改写原值。
 * @param {string} name 持久化的图标名称
 * @returns {import('vue').Component} Lucide 图标组件
 */
export function resolveListIcon(name) {
  return LIST_ICONS[name] || List
}
