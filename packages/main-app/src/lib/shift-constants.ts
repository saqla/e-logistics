// 固定6ルートの統一カラー（/shift 画面全体でこのマップを唯一の情報源とする）
export type FixedRouteKey = 'SANCHOKU' | 'DONKI_FUKUOKA' | 'DONKI_NAGASAKI' | 'UNIC' | 'OFF' | 'PAID_LEAVE'

export const ROUTE_COLOR_CLASSES: Record<FixedRouteKey, { bg: string; text: string }> = {
  SANCHOKU: { bg: 'bg-green-100', text: 'text-green-800' },
  DONKI_FUKUOKA: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  DONKI_NAGASAKI: { bg: 'bg-orange-100', text: 'text-orange-800' },
  UNIC: { bg: 'bg-blue-100', text: 'text-blue-800' },
  OFF: { bg: 'bg-red-100', text: 'text-red-800' },
  PAID_LEAVE: { bg: 'bg-purple-100', text: 'text-purple-800' },
}

// route-defs API の key から色を引く。固定6種以外はDB保存済みのbgClass/textClassにフォールバックする
export function getRouteColorByKey(key: string, fallbackBg?: string, fallbackText?: string): string {
  const c = (ROUTE_COLOR_CLASSES as Record<string, { bg: string; text: string } | undefined>)[key]
  if (c) return `${c.bg} ${c.text}`
  if (fallbackBg || fallbackText) return `${fallbackBg ?? ''} ${fallbackText ?? ''}`.trim()
  return ''
}

// 新規追加ルート用の予備パレット（固定6色と被らない配色を順番に自動割当）
export const EXTRA_ROUTE_COLOR_PALETTE: { bg: string; text: string }[] = [
  { bg: 'bg-teal-100', text: 'text-teal-800' },
  { bg: 'bg-pink-100', text: 'text-pink-800' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  { bg: 'bg-lime-100', text: 'text-lime-800' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
]

// 予定表投影用ルートキー（必要に応じてUI/DBから直接設定）
export type ScheduleRouteKey = 'ESAKI_DONKI' | 'SANCHOKU' | 'MARUNO_DONKI'

export const SHIFT_TO_SCHEDULE_ROUTE: Record<string, ScheduleRouteKey | null> = {
  SANCHOKU: 'SANCHOKU',
  DONKI_FUKUOKA: 'ESAKI_DONKI',
  DONKI_NAGASAKI: 'MARUNO_DONKI',
  UNIC: null,
  OFF: null,
  PAID_LEAVE: null,
}
