"use client"

import { useState } from "react"
import { useSession, signOut, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginModal } from "@/components/login-modal"
import { TopSiteHeader } from "@/components/topSite-header"
import { ExternalLink } from "lucide-react"

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState<string | null>(null)
  const [shiftUpdatedAt, setShiftUpdatedAt] = useState<string | null>(null)

  const formatUpdatedAt = (iso: string): string => {
    try {
      const d = new Date(iso)
      const parts = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(d)
      const get = (t: Intl.DateTimeFormatPart['type']) => parts.find(p => p.type === t)?.value ?? ''
      const month = get('month')
      const day = get('day')
      const hour = get('hour')
      const minute = get('minute')
      return `${month}月${day}日 ${hour}時${minute}分`
    } catch {
      return '—'
    }
  }
  // portrait検知とビューポート幅
  const [vw, setVw] = useState(0)
  const [vh, setVh] = useState(0)
  const [isPortrait, setPortrait] = useState(true)
  useEffect(() => {
    const onResize = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 0
      const h = typeof window !== 'undefined' ? window.innerHeight : 0
      setVw(w); setVh(h)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setPortrait(e.matches)
    setPortrait(mq.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  const handleLoginSuccess = () => {
    // ログイン成功時はページをリロードしてセッションを更新
    window.location.reload()
  }

  useEffect(() => {
    console.log("Session status:", status)
    console.log("Session data:", session)
    if (status === "unauthenticated") {
      // 未認証時は何もしない（ログインが必要）
    }
  }, [status, session, router])

  useEffect(() => {
    // 認証後に最新更新日時を取得
    const fetchUpdated = async () => {
      try {
        const res = await fetch('/api/schedule/updated', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        setScheduleUpdatedAt(json?.updatedAt ?? null)
      } catch {}
    }
    const fetchShiftUpdated = async () => {
      try {
        const res = await fetch('/api/shift/updated', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        const iso = typeof json?.updatedAt === 'string' ? json.updatedAt : (json?.updatedAt?._seconds ? new Date(json.updatedAt._seconds * 1000).toISOString() : null)
        setShiftUpdatedAt(iso ?? null)
      } catch {}
    }
    if (status === 'authenticated') {
      fetchUpdated()
      fetchShiftUpdated()
    }
  }, [status])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  // ログイン済みの場合はアプリリストを表示
  if (session && status === "authenticated") {
    const handleLogout = () => {
      signOut({ callbackUrl: "/" })
    }

    // アプリ一覧
    const apps = [
      {
        id: "schedule",
        name: "月予定表",
        description: "自社の月間スケジュール管理",
        status: "利用可"
      },
      {
        id: "shift",
        name: "箱車シフト表",
        description: "箱車のシフト管理",
        status: "利用可"
      }
    ]

    return (
      <div className="min-h-screen bg-gray-50">
        <TopSiteHeader />

        {/* スマホ/タブレット縦: ダッシュボード上に編集ボタン群（社内ログイン済み時のみ） */}
        {(isPortrait && vw > 0 && vw < 1200) ? (
          <div className="block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-gray-700">ようこそ、{((session as any)?.editorVerified && (typeof document !== 'undefined' && /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(document.cookie || '') === false)) ? (session.user?.name || session.user?.email) : '社内ユーザー'}</span>
              <div className="flex items-center gap-2">
                {(session as any)?.editorVerified && (typeof document !== 'undefined' && /(?:^|;\s*)editor_disabled=1(?:;|$)/.test(document.cookie || '') === false) ? (
                  <button
                    onClick={() => { document.cookie = 'editor_disabled=1; Path=/; Max-Age=31536000; SameSite=Lax'; window.location.reload() }}
                    className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600"
                  >
                    個別ログアウト
                  </button>
                ) : (
                  <button
                    onClick={() => { document.cookie = 'editor_disabled=; Path=/; Max-Age=0; SameSite=Lax'; signIn('google') }}
                    className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                  >
                    編集ログイン
                  </button>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* メインコンテンツ */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                ダッシュボード
              </h2>
              <p className="text-lg text-gray-600">
                利用可能なアプリケーションを選択してください
              </p>
            </div>

            {/* アプリ一覧 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apps.map((app) => (
                <Card
                  key={app.id}
                  className={`hover:shadow-lg transition-shadow ${app.status === "利用可" ? "bg-emerald-50" : app.status === "開発中" ? "bg-amber-50" : ""}`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {app.name}
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">{app.status}</span>
                    </CardTitle>
                    <CardDescription className="text-base">
                      {app.description}
                    </CardDescription>
                    {app.id === 'schedule' ? (
                      <div className="mt-1 text-xs text-gray-600">
                        内容更新日 : {scheduleUpdatedAt ? formatUpdatedAt(scheduleUpdatedAt) : '—'}
                      </div>
                    ) : app.id === 'shift' ? (
                      <div className="mt-1 text-xs text-gray-600">
                        内容更新日 : {shiftUpdatedAt ? formatUpdatedAt(shiftUpdatedAt) : '—'}
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full text-base" onClick={() => router.push(`/${app.id}`)}>
                      起動
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 開発中メッセージ */}
            <div className="mt-12 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-blue-900 mb-2">
                  🚧 開発中です
                </h3>
                <p className="text-blue-700">
                  各アプリケーションの開発を進めています。しばらくお待ちください。
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 未ログインの場合はシンプルなログインページを表示
  console.log("Rendering login page - status:", status, "session:", session)
  return (
    <div className="min-h-screen bg-white">
      <TopSiteHeader />

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-8">
            <Image
              src="/logo.png"
              alt="E-Logistics Logo"
              width={200}
              height={67}
              className="w-[200px] h-[67px] object-contain mx-auto mb-6"
              priority
            />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              E-Logistics
            </h1>
            <p className="text-gray-600">
              社内業務管理システム
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                ログインが必要です
              </h2>
              <p className="text-gray-600 mb-6">
                システムにアクセスするには、ログインしてください。
              </p>
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full px-8 py-3 bg-blue-600 text-white text-lg rounded-md hover:bg-blue-700 transition-colors"
              >
                ログイン
              </button>
            </div>
          </div>
          <div className="mt-6 text-center">
            <p className="text-base text-gray-700">ホームページはこちら</p>
            <Button
              asChild
              variant="link"
              className="text-base p-0 h-auto mt-1 font-semibold underline underline-offset-4 inline-flex items-center gap-1"
            >
              <Link
                href="http://e-logistics.jp/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Eロジスティクス公式サイトを新規タブで開く"
              >
                EロジHP（公式サイト）
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      {/* ログインモーダル */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  )
}
