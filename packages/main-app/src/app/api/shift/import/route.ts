import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 本APIは初回のみ使用想定。Bodyに assignments を渡して保存。
export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const year = Number(body?.year)
  const month = Number(body?.month)
  const arr: any[] = Array.isArray(body?.assignments) ? body.assignments : []
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  // 正規化 + 重複排除
  const normalized = arr
    .filter(a => a && a.staffId && String(a.staffId).trim() !== '' && a.day)
    .map(a => ({
      day: Number(a.day),
      staffId: String(a.staffId),
      route: String(a.route),
      carNumber: a.carNumber == null || String(a.carNumber).trim() === '' ? null : String(a.carNumber),
      noteBL: a.noteBL == null || String(a.noteBL).trim() === '' ? null : String(a.noteBL),
      noteBR: a.noteBR == null || String(a.noteBR).trim() === '' ? null : String(a.noteBR),
    }))
    .sort((x, y) => (x.day - y.day))

  const seen = new Set<string>()
  const deduped: typeof normalized = []
  for (const it of normalized) {
    const key = `${it.day}-${it.staffId}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(it)
  }

  await prisma.$transaction(async tx => {
    await tx.shiftAssignment.deleteMany({ where: { year, month } })
    for (const a of deduped) {
      await tx.shiftAssignment.create({ data: { year, month, day: a.day, staffId: a.staffId, route: a.route as any, carNumber: a.carNumber, noteBL: a.noteBL, noteBR: a.noteBR } })
    }
  })

  return NextResponse.json({ ok: true, count: deduped.length })
}


