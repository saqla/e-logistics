import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { StaffKind } from '@prisma/client'
import { ensurePaidLeaveColumns } from '@/lib/paid-leave'

const isPreview = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production'

// PATCH /api/staff/:id  { name?, kind? }
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions as any)
    const cookie = _req.headers.get('cookie') || ''
    const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
    if (!(session as any)?.editorVerified || disabled) {
      return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
    await ensurePaidLeaveColumns()
    const id = params.id
    let body: any
    try {
      body = await _req.json()
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const name: string | undefined = body?.name?.trim()
    const kind: string | undefined = body?.kind
    const hireDateRaw = body?.hireDate
    const hasHireDate = hireDateRaw !== undefined
    const hasPaidLeaveTotalDays = body?.paidLeaveTotalDays !== undefined

    if (!name && !kind && !hasHireDate && !hasPaidLeaveTotalDays) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    if (name) {
      const dup = await prisma.staff.findFirst({ where: { id: { not: id }, name, deletedAt: null }, select: { id: true } })
      if (dup) {
        return NextResponse.json({ error: '同名のスタッフが既に存在します' }, { status: 409 })
      }
    }

    const data: { name?: string; kind?: StaffKind; hireDate?: Date | null; paidLeaveTotalDays?: number } = {}
    if (name) data.name = name
    if (kind) {
      const upper = String(kind).toUpperCase()
      if (!Object.values(StaffKind).includes(upper as StaffKind)) {
        return NextResponse.json({ error: '種別kindが不正です' }, { status: 400 })
      }
      data.kind = upper as StaffKind
    }
    if (hasHireDate) {
      data.hireDate = hireDateRaw ? new Date(hireDateRaw) : null
    }
    if (hasPaidLeaveTotalDays) {
      data.paidLeaveTotalDays = Number(body.paidLeaveTotalDays) || 0
    }

    const updated = await prisma.staff.update({
      where: { id },
      data,
      select: { id: true, name: true, kind: true, deletedAt: true, createdAt: true, updatedAt: true, hireDate: true, paidLeaveTotalDays: true }
    })
    return NextResponse.json({ staff: updated })
  } catch (err) {
    const error = err as Error
    console.error('[PATCH /api/staff/:id] Error:', error)
    return NextResponse.json({ error: isPreview ? error.message : 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/staff/:id  論理削除（復元可能）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions as any)
    const cookie = _req.headers.get('cookie') || ''
    const disabled = /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(cookie)
    if (!(session as any)?.editorVerified || disabled) {
      return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
    const id = params.id
    const updated = await prisma.staff.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true, name: true, kind: true, deletedAt: true, createdAt: true, updatedAt: true }
    })
    return NextResponse.json({ staff: updated })
  } catch (err) {
    const error = err as Error
    console.error('[DELETE /api/staff/:id] Error:', error)
    return NextResponse.json({ error: isPreview ? error.message : 'Internal Server Error' }, { status: 500 })
  }
}


