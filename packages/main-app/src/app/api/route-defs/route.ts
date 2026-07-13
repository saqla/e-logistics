import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { EXTRA_ROUTE_COLOR_PALETTE } from '@/lib/shift-constants'

async function ensureSchema() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='route_definitions' LIMIT 1"
    )
    const exists = Array.isArray(rows) && rows.length > 0
    if (exists) return
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "route_definitions" (
      "id" TEXT PRIMARY KEY,
      "key" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      "bgClass" TEXT NOT NULL DEFAULT '',
      "textClass" TEXT NOT NULL DEFAULT '',
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`)
  } catch {}
}

async function ensureDefaults() {
  // シフト予定表の既定ルートのみを保証（不足分だけupsert）。
  // 「有給」は運行ルートではなく休み行側の種別として扱うため、ここには含めない。
  const defaults: { key: string; name: string; order: number; bgClass: string; textClass: string; enabled: boolean }[] = [
    { key: 'SANCHOKU',       name: '産直',       order: 20, bgClass: 'bg-green-500',  textClass: 'text-white',     enabled: true },
    { key: 'DONKI_FUKUOKA',  name: 'ドンキ(福岡)', order: 40, bgClass: 'bg-orange-500', textClass: 'text-white',     enabled: true },
    { key: 'DONKI_NAGASAKI', name: 'ドンキ(長崎)', order: 50, bgClass: 'bg-violet-400', textClass: 'text-white',     enabled: true },
    { key: 'UNIC',           name: 'ユニック',   order: 60, bgClass: 'bg-blue-500',   textClass: 'text-white',     enabled: true },
    { key: 'OFF',            name: '休み',       order: 70, bgClass: 'bg-gray-200',   textClass: 'text-gray-900',  enabled: true },
  ]
  for (const d of defaults) {
    await prisma.routeDefinition.upsert({
      where: { key: d.key },
      update: {},
      create: d,
    })
  }
}

// 過去に既定ルートとして作られていた「有給」を除去し、それを使っていた割当は空車に戻す
async function removeObsoletePaidLeaveRoute() {
  try {
    const existing = await prisma.routeDefinition.findUnique({ where: { key: 'PAID_LEAVE' } })
    if (!existing) return
    await prisma.$transaction([
      prisma.shiftAssignment.updateMany({ where: { route: 'PAID_LEAVE' }, data: { route: null } }),
      prisma.routeDefinition.delete({ where: { key: 'PAID_LEAVE' } }),
    ])
  } catch {}
}

export async function GET() {
  await ensureSchema()
  // シフト用の不足分のみ作成（毎回冪等upsert）
  await ensureDefaults()
  await removeObsoletePaidLeaveRoute()
  const items = await prisma.routeDefinition.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any)
  const cookie = req.headers.get('cookie') || ''
  const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
  if (!(session as any)?.editorVerified || disabled) {
    return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
  }
  await ensureSchema()
  const body = await req.json().catch(() => ({}))
  const name = (body?.name||'').toString().trim()
  if (!name) return NextResponse.json({ error: 'nameは必須です' }, { status: 400 })

  // key未指定時は自動生成（画面からの「追加」はnameのみで呼べる）
  const key = (body?.key||'').toString().trim() || `custom_${randomUUID().replace(/-/g, '')}`

  // order未指定時は既存の最大値+10を自動採番（末尾に追加）
  let order = Number(body?.order)
  if (!Number.isFinite(order)) {
    const agg = await prisma.routeDefinition.aggregate({ _max: { order: true } })
    order = (agg._max.order ?? 0) + 10
  }

  const enabled = body?.enabled == null ? true : !!body.enabled

  // 色未指定時は共通の予備パレットから自動割当（既存カラーマップと衝突しないように既存カスタム数で巡回）
  let bgClass = (body?.bgClass||'').toString()
  let textClass = (body?.textClass||'').toString()
  if (!bgClass || !textClass) {
    const customCount = await prisma.routeDefinition.count({ where: { key: { startsWith: 'custom_' } } })
    const palette = EXTRA_ROUTE_COLOR_PALETTE[customCount % EXTRA_ROUTE_COLOR_PALETTE.length]
    bgClass = bgClass || palette.bg
    textClass = textClass || palette.text
  }

  try {
    const created = await prisma.routeDefinition.create({ data: { key, name, order, bgClass, textClass, enabled } })
    return NextResponse.json({ item: created })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: '同じキーが既に存在します' }, { status: 409 })
    return NextResponse.json({ error: e?.message || '作成に失敗しました' }, { status: 500 })
  }
}


