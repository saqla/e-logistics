import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/shift?year=2025&month=11
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  const assignments = await prisma.shiftAssignment.findMany({
    where: { year, month },
    orderBy: [{ day: 'asc' }],
    select: { id: true, year: true, month: true, day: true, staffId: true, route: true, carNumber: true, noteBL: true, noteBR: true, updatedAt: true }
  })
  return NextResponse.json({ assignments })
}

// POST /api/shift  { year, month, assignments: ShiftAssignment[] }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const year: number = Number(body?.year)
  const month: number = Number(body?.month)
  const arr: any[] = Array.isArray(body?.assignments) ? body.assignments : []
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  // 正規化 + サーバーサイド重複排除（同一日×同一スタッフは最初の1件のみ）
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

  // 置換保存（対象月を全削除→作成）
  await prisma.$transaction(async tx => {
    await tx.shiftAssignment.deleteMany({ where: { year, month } })
    for (const a of deduped) {
      await tx.shiftAssignment.create({
        data: { year, month, day: a.day, staffId: a.staffId, route: a.route as any, carNumber: a.carNumber, noteBL: a.noteBL, noteBR: a.noteBR }
      })
    }
  })

  return NextResponse.json({ ok: true })
}


