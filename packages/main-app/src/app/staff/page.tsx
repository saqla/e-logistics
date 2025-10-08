"use client"
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Staff = { id: string; name: string; kind: 'ALL'|'UNIC'|'HAKO'|'JIMU'; lowerCount: number }

const KIND_LABEL: Record<Staff['kind'], string> = {
  ALL: 'All',
  UNIC: 'ユニック',
  HAKO: '箱車',
  JIMU: '事務'
}

export default function StaffPage() {
  const { status, data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const today = new Date()
  const ym = useMemo(() => ({ year: today.getFullYear(), month: today.getMonth() + 1 }), [today])

  const [items, setItems] = useState<Staff[]>([])
  const [deleted, setDeleted] = useState<Staff[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [activeRes, deletedRes] = await Promise.all([
        fetch(`/api/staff?year=${ym.year}&month=${ym.month}`, { cache: 'no-store' }),
        fetch(`/api/staff/deleted`, { cache: 'no-store' })
      ])
      const a = await activeRes.json()
      const d = await deletedRes.json()
      setItems(a.staffs || [])
      setDeleted(d.staffs || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Staff['kind']>('ALL')
  const isEdit = !!editId

  const openCreate = () => { setEditId(null); setName(''); setKind('ALL'); setOpen(true) }
  const openEdit = (s: Staff) => { setEditId(s.id); setName(s.name); setKind(s.kind); setOpen(true) }

  const save = async () => {
    const payload = { name: name.trim(), kind }
    const res = await fetch(editId ? `/api/staff/${editId}` : '/api/staff', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert(e.error || '保存に失敗しました')
      return
    }
    setOpen(false)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('このスタッフを削除します。よろしいですか？')) return
    const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert(e.error || '削除に失敗しました')
      return
    }
    load()
  }

  const restore = async (id: string) => {
    const res = await fetch(`/api/staff/deleted`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert(e.error || '復元に失敗しました')
      return
    }
    load()
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">スタッフ一覧管理</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/schedule')}>月予定表へ</Button>
            {(session as any)?.editorVerified && <Button onClick={openCreate}>新規追加</Button>}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>有効スタッフ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 divide-y">
              <div className="grid grid-cols-[100px_1fr_140px] text-sm text-gray-500 py-2">
                <div>下段表示数</div>
                <div>名前</div>
                <div>操作</div>
              </div>
              {items.map((s) => (
                <div key={s.id} className="grid grid-cols-[100px_1fr_140px] items-center py-2">
                  <div className={s.lowerCount >= 9 ? 'text-pink-600 font-semibold' : ''}>{s.lowerCount}</div>
                  <button className="text-left hover:underline" onClick={() => ((session as any)?.editorVerified) && openEdit(s)}>
                    {s.name}
                  </button>
                  <div className="flex gap-2">
                    {(session as any)?.editorVerified && <Button variant="outline" onClick={() => openEdit(s)}>編集</Button>}
                    {(session as any)?.editorVerified && <Button variant="destructive" onClick={() => remove(s.id)}>削除</Button>}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-sm text-gray-500 py-4">データがありません</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="h-6" />

        <Card>
          <CardHeader>
            <CardTitle>削除済み（復元可能）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 divide-y">
              {deleted.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2">
                  <div>
                    {s.name}
                  </div>
                  <Button variant="outline" onClick={() => restore(s.id)}>復元</Button>
                </div>
              ))}
              {deleted.length === 0 && (
                <div className="text-sm text-gray-500 py-4">削除済みはありません</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={(session as any)?.editorVerified && open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEdit ? 'スタッフ編集' : 'スタッフ追加'}</DialogTitle>
            </DialogHeader>
            {isEdit ? (
              <button
                type="button"
                className="w-full border rounded-md p-3 bg-gray-50 text-left"
                onClick={() => {
                  const nameEl = document.getElementById('name') as HTMLInputElement | null
                  nameEl?.focus()
                }}
                title="タップで編集"
              >
                <div className="text-sm text-gray-500 mb-1">タップで編集</div>
                <div className="space-y-2">
                  <div><span className="text-gray-500 mr-2">名前</span>{name}</div>
                  <div><span className="text-gray-500 mr-2">種別</span>{KIND_LABEL[kind]}</div>
                </div>
              </button>
            ) : null}
            <div className="space-y-4 mt-3">
              <div>
                <Label htmlFor="name">名前</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!((session as any)?.editorVerified)} />
              </div>
              <div>
                <Label htmlFor="kind">種別</Label>
                <select id="kind" className="mt-1 w-full border rounded-md h-10 px-3 text-sm max-sm:text-lg" value={kind} onChange={(e) => setKind(e.target.value as Staff['kind'])} disabled={!((session as any)?.editorVerified)}>
                  <option value="ALL">All</option>
                  <option value="UNIC">ユニック</option>
                  <option value="HAKO">箱車</option>
                  <option value="JIMU">事務</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
              <Button onClick={save} disabled={!((session as any)?.editorVerified)}>保存</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}


