import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 本APIは初回のみ使用想定。Bodyに assignments を渡して保存。
export async function POST(req: Request) {
  // シークレットトークン必須（ヘッダ x-import-token）
  const token = req.headers.get('x-import-token') || ''
  if (!process.env.SHIFT_IMPORT_TOKEN || token !== process.env.SHIFT_IMPORT_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // 追加で通常の認可も満たす場合はOK（なくても上記トークンで通す）
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const year = Number(body?.year)
  const month = Number(body?.month)
  const arrRaw: any[] = Array.isArray(body?.assignments) ? body.assignments : []
  if (!year || !month) return NextResponse.json({ error: 'year, month は必須' }, { status: 400 })

  // staffName から staffId を補完
  const names = Array.from(new Set(
    arrRaw
      .filter(a => a && !a.staffId && a.staffName)
      .map(a => String(a.staffName).trim())
      .filter(n => n.length > 0)
  ))
  const nameMap: Record<string, string> = {}
  if (names.length > 0) {
    const found = await prisma.staff.findMany({ where: { name: { in: names }, deletedAt: null }, select: { id: true, name: true } })
    for (const s of found) nameMap[s.name] = s.id
  }

  // 正規化 + 重複排除（staffId 優先、無ければ staffName から解決）
  const normalized = arrRaw
    .map(a => ({
      day: Number(a?.day),
      staffId: (a?.staffId && String(a.staffId).trim() !== '') ? String(a.staffId) : (a?.staffName ? (nameMap[String(a.staffName).trim()] || '') : ''),
      route: String(a?.route ?? ''),
      carNumber: a?.carNumber == null || String(a.carNumber).trim() === '' ? null : String(a.carNumber),
      noteBL: a?.noteBL == null || String(a.noteBL).trim() === '' ? null : String(a.noteBL),
      noteBR: a?.noteBR == null || String(a.noteBR).trim() === '' ? null : String(a.noteBR),
    }))
    .filter(a => a.day && a.staffId)
    .map(a => ({
      day: a.day,
      staffId: a.staffId,
      route: a.route,
      carNumber: a.carNumber,
      noteBL: a.noteBL,
      noteBR: a.noteBR,
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


