export const ROUTE_LABELS = [
  '産直',
  'ドンキ(福岡)',
  'ドンキ(長崎)',
  'ユニック',
  '休み',
  '有給',
] as const

export type RouteLabel = typeof ROUTE_LABELS[number]

export const CAR_LABELS = ['8514', '3717', '4825', '?', ''] as const
export type CarLabel = typeof CAR_LABELS[number]

export function routeLabelToEnum(label: RouteLabel): 'SANCHOKU'|'DONKI_FUKUOKA'|'DONKI_NAGASAKI'|'UNIC'|'OFF'|'PAID_LEAVE' {
  switch (label) {
    case '産直': return 'SANCHOKU'
    case 'ドンキ(福岡)': return 'DONKI_FUKUOKA'
    case 'ドンキ(長崎)': return 'DONKI_NAGASAKI'
    case 'ユニック': return 'UNIC'
    case '休み': return 'OFF'
    case '有給': return 'PAID_LEAVE'
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

// 色マッピング
export function getRouteColor(label: RouteLabel): string {
  switch (label) {
    case '産直': return 'bg-purple-600 text-white'
    case 'ドンキ(福岡)': return 'bg-orange-500 text-white'
    case 'ドンキ(長崎)': return 'bg-violet-400 text-white'
    case 'ユニック': return 'bg-green-500 text-white'
    case '休み': return 'bg-red-500 text-white'
    case '有給': return 'bg-red-500 text-white'
  }
}

export function getCarColor(car: string): string {
  switch (car) {
    case '8514': return 'bg-purple-600 text-white'
    case '3717': return 'bg-orange-500 text-white'
    case '4825': return 'bg-violet-400 text-white'
    case '?': return 'bg-gray-400 text-white'
    default: return 'bg-gray-200 text-gray-700'
  }
}


