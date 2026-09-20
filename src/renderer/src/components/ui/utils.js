import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind 类名：clsx 处理条件类，tailwind-merge 解决冲突。
 * 基础组件统一通过该函数接受外部 class，避免调用方覆盖变体样式失败。
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
