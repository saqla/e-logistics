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
  const routes: ('ESAKI_DONKI'|'SANCHOKU'|'MARUNO_DONKI')[] = Array.isArray(body?.routes) && body.routes.length
    ? body.routes
    : ['ESAKI_DONKI','SANCHOKU','MARUNO_DONKI']

  // 対象月のシフト取得（空車＝driverStaffId未設定の車両は生成対象から除外）
  const shifts = await prisma.shiftAssignment.findMany({
    where: { year, month, driverStaffId: { not: null } },
    select: { day: true, driverStaffId: true, route: true, scheduleRouteKey: true, noteBL: true, noteBR: true },
  })

  // 日×scheduleRouteKeyの担当を決定（同日同ルートキーが複数車両で衝突した場合は先勝ち）
  const byDayRoute = new Map<string, string>() // key: `${day}-${routeKey}` -> driverStaffId
  for (const s of shifts) {
    if (!s.driverStaffId) continue
    const routeKey = s.scheduleRouteKey ?? (s.route ? SHIFT_TO_SCHEDULE_ROUTE[String(s.route)] : null)
    if (!routeKey || !routes.includes(routeKey as any)) continue
    const key = `${s.day}-${routeKey}`
    if (!byDayRoute.has(key)) {
      byDayRoute.set(key, s.driverStaffId)
    }
  }

  // 書き込み
  await prisma.$transaction(async (tx) => {
    if (overwrite) {
      await tx.routeAssignment.deleteMany({ where: { year, month } })
    }
    const entries = Array.from(byDayRoute.entries())
    for (const [k, staffId] of entries) {
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


