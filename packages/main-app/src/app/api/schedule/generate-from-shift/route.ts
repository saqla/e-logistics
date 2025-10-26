import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SHIFT_TO_SCHEDULE_ROUTE } from '@/lib/shift-constants'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  let body: any
  try { body = await req.json().catch(() => ({})) } catch { body = {} }
  const overwrite = !!body?.overwrite
  const routes: ('EZAKI_DONKI'|'SANCHOKU'|'MARUNO_DONKI')[] = Array.isArray(body?.routes) && body.routes.length
    ? body.routes
    : ['EZAKI_DONKI','SANCHOKU','MARUNO_DONKI']

  // 対象月のシフト取得
  const shifts = await prisma.shiftAssignment.findMany({
    where: { year, month },
    select: { day: true, staffId: true, route: true, scheduleRouteKey: true, role: true, priority: true, noteBL: true, noteBR: true },
  })

  // 日×scheduleRouteKeyの担当を決定
  type Cand = { staffId: string; role?: string | null; priority?: number | null }
  const pick = (cands: Cand[]): Cand | null => {
    if (cands.length === 0) return null
    // role優先 (driver>assistant>) -> priority (asc) -> 先頭
    const roleRank = (r?: string | null) => r === 'driver' ? 0 : r === 'assistant' ? 1 : 2
    cands.sort((a, b) => (roleRank(a.role) - roleRank(b.role)) || ((a.priority ?? 0) - (b.priority ?? 0)))
    return cands[0]
  }

  const byDayRoute = new Map<string, string>() // key: `${day}-${routeKey}` -> staffId
  for (const s of shifts) {
    const routeKey = s.scheduleRouteKey ?? SHIFT_TO_SCHEDULE_ROUTE[String(s.route)]
    if (!routeKey || !routes.includes(routeKey as any)) continue
    const key = `${s.day}-${routeKey}`
    const prev = byDayRoute.get(key)
    if (!prev) {
      byDayRoute.set(key, s.staffId)
    } else {
      // 衝突時はrole/priorityで決定
      // 実装簡易化のため、後勝ちではなく比較
      const current = { staffId: byDayRoute.get(key)! } as Cand
      const cand = pick([current, { staffId: s.staffId, role: s.role, priority: s.priority }])
      if (cand) byDayRoute.set(key, cand.staffId)
    }
  }

  // 書き込み
  await prisma.$transaction(async (tx) => {
    if (overwrite) {
      await tx.routeAssignment.deleteMany({ where: { year, month } })
    }
    for (const [k, staffId] of byDayRoute.entries()) {
      const [dayStr, routeKey] = k.split('-')
      const day = Number(dayStr)
      await tx.routeAssignment.upsert({
        where: { year_month_day_route: { year, month, day, route: routeKey as any } },
        update: { staffId },
        create: { year, month, day, route: routeKey as any, staffId },
      })
    }
  })

  return NextResponse.json({ ok: true, assigned: byDayRoute.size })
}


