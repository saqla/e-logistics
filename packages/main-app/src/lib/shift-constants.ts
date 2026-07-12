export const ROUTE_LABELS = [
  '産直',
  'ドンキ(福岡)',
  'ドンキ(長崎)',
  'ユニック',
  '休み',
  '有給',
] as const

export type RouteLabel = typeof ROUTE_LABELS[number]

export function routeLabelToEnum(label: string): 'SANCHOKU'|'DONKI_FUKUOKA'|'DONKI_NAGASAKI'|'UNIC'|'OFF'|'PAID_LEAVE' {
  switch (label) {
    case '産直': return 'SANCHOKU'
    case 'ドンキ(福岡)': return 'DONKI_FUKUOKA'
    case 'ドンキ(長崎)': return 'DONKI_NAGASAKI'
    case 'ユニック': return 'UNIC'
    case '休み': return 'OFF'
    case '有給': return 'PAID_LEAVE'
    default: return 'SANCHOKU'
  }
}

export function enumToRouteLabel(e: string): RouteLabel {
  switch (e) {
    case 'SANCHOKU': return '産直'
    case 'DONKI_FUKUOKA': return 'ドンキ(福岡)'
    case 'DONKI_NAGASAKI': return 'ドンキ(長崎)'
    case 'UNIC': return 'ユニック'
    case 'OFF': return '休み'
    case 'PAID_LEAVE': return '有給'
    default: return '産直'
  }
}

// 色マッピング（ルート種別ごとの統一カラー。/shift 画面全体でこのマップを唯一の情報源とする）
export const ROUTE_COLOR_CLASSES: Record<ReturnType<typeof routeLabelToEnum>, { bg: string; text: string }> = {
  SANCHOKU: { bg: 'bg-green-100', text: 'text-green-800' },
  DONKI_FUKUOKA: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  DONKI_NAGASAKI: { bg: 'bg-orange-100', text: 'text-orange-800' },
  UNIC: { bg: 'bg-blue-100', text: 'text-blue-800' },
  OFF: { bg: 'bg-red-100', text: 'text-red-800' },
  PAID_LEAVE: { bg: 'bg-purple-100', text: 'text-purple-800' },
}

export function getRouteColor(label: RouteLabel): string {
  const { bg, text } = ROUTE_COLOR_CLASSES[routeLabelToEnum(label)]
  return `${bg} ${text}`
}

// route-defs API の key（'SANCHOKU' 等のenum文字列）から直接色を引く場合はこちら
export function getRouteColorByKey(key: string): string {
  const c = (ROUTE_COLOR_CLASSES as Record<string, { bg: string; text: string } | undefined>)[key]
  return c ? `${c.bg} ${c.text}` : ''
}

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


