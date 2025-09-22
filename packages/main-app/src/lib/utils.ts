import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function getDow(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay() // 0=Sun..6=Sat
}

// 日本の祝日（簡易）: ライブラリ未導入のため、日曜のみ赤扱い。土曜=6、水曜=3
// 別途、祝日ライブラリ導入時に差し替え可能
export function isHoliday(year: number, month: number, day: number): boolean {
  const dow = getDow(year, month, day)
  return dow === 0
}