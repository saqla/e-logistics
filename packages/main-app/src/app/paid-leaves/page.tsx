"use client"
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PaidLeaveItem = {
  staffId: string
  name: string
  hireDate: string | null
  tenureYears: number | null
  nextGrantMonth: string | null
  totalDays: number
  usedDays: number
  remainingDays: number
}

const fmtHireDate = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

const toDateInputValue = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export default function PaidLeavesPage() {
  const { status, data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const editorVerified = (session as any)?.editorVerified === true

  const [items, setItems] = useState<PaidLeaveItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/paid-leaves', { cache: 'no-store' })
      const j = await r.json().catch(() => ({ items: [] }))
      setItems(Array.isArray(j.items) ? j.items : [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // 詳細（使用日履歴）ダイアログ
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyStaffName, setHistoryStaffName] = useState('')
  const [historyDates, setHistoryDates] = useState<{ year: number; month: number; day: number }[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const openHistory = async (item: PaidLeaveItem) => {
    setHistoryStaffName(item.name)
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const r = await fetch(`/api/paid-leaves/${item.staffId}/history`, { cache: 'no-store' })
      const j = await r.json().catch(() => ({ dates: [] }))
      setHistoryDates(Array.isArray(j.dates) ? j.dates : [])
    } finally {
      setHistoryLoading(false)
    }
  }

  // 編集（入社日・総付与日数）ダイアログ
  const [editOpen, setEditOpen] = useState(false)
  const [editStaffId, setEditStaffId] = useState<string | null>(null)
  const [editHireDate, setEditHireDate] = useState('')
  const [editTotalDays, setEditTotalDays] = useState('0')

  const openEdit = (item: PaidLeaveItem) => {
    setEditStaffId(item.staffId)
    setEditHireDate(toDateInputValue(item.hireDate))
    setEditTotalDays(String(item.totalDays))
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editStaffId) return
    const r = await fetch(`/api/staff/${editStaffId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hireDate: editHireDate ? editHireDate : null,
        paidLeaveTotalDays: Number(editTotalDays) || 0,
      }),
    })
    if (!r.ok) {
      let msg = '保存に失敗しました'
      try { const j = await r.json(); if (j?.error) msg = j.error } catch {}
      alert(msg)
      return
    }
    setEditOpen(false)
    await load()
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">有給管理・消化状況台帳</h1>
          <Button variant="outline" onClick={() => router.push('/shift')}>シフト表へ戻る</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>スタッフ別 有給消化状況（今期）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-1 divide-y min-w-[900px]">
                <div className="grid grid-cols-[1fr_110px_90px_110px_90px_110px_100px_140px] text-sm text-gray-500 py-2 gap-2">
                  <div>スタッフ名</div>
                  <div>入社日</div>
                  <div>継続年数</div>
                  <div>次回追加年月</div>
                  <div>総付与日数</div>
                  <div>実使用日数</div>
                  <div>残り日数</div>
                  <div>操作</div>
                </div>
                {items.map(item => (
                  <div key={item.staffId} className="grid grid-cols-[1fr_110px_90px_110px_90px_110px_100px_140px] items-center py-2 gap-2 text-sm">
                    <button className="text-left hover:underline font-medium" onClick={() => openHistory(item)}>{item.name}</button>
                    <div>{fmtHireDate(item.hireDate)}</div>
                    <div>{item.tenureYears != null ? `${item.tenureYears}年` : '—'}</div>
                    <div>{item.nextGrantMonth ?? '—'}</div>
                    <div>{item.totalDays}日</div>
                    <div>{item.usedDays}日</div>
                    <div className={item.remainingDays < 0 ? 'text-red-600 font-bold' : ''}>{item.remainingDays}日</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openHistory(item)}>詳細</Button>
                      {editorVerified && <Button size="sm" variant="outline" onClick={() => openEdit(item)}>編集</Button>}
                    </div>
                  </div>
                ))}
                {items.length === 0 && !loading && (
                  <div className="text-sm text-gray-500 py-4">データがありません</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 使用日履歴ダイアログ */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{historyStaffName} の今期 有給使用日</DialogTitle>
            </DialogHeader>
            {historyLoading ? (
              <div className="text-sm text-gray-600">読み込み中…</div>
            ) : historyDates.length > 0 ? (
              <div className="text-sm text-gray-800">
                {historyDates.map(d => `${d.month}月${d.day}日`).join('、')}
              </div>
            ) : (
              <div className="text-sm text-gray-500">今期の有給使用はまだありません</div>
            )}
          </DialogContent>
        </Dialog>

        {/* 編集ダイアログ */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>入社日・総付与日数を編集</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="hireDate">入社日</Label>
                <Input id="hireDate" type="date" value={editHireDate} onChange={e => setEditHireDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="totalDays">今年度の総付与日数</Label>
                <Input id="totalDays" type="number" min={0} value={editTotalDays} onChange={e => setEditTotalDays(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditOpen(false)}>キャンセル</Button>
              <Button onClick={saveEdit}>保存</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
