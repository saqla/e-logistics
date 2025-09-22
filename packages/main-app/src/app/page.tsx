"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginModal } from "@/components/login-modal"

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

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
        name: "シフト表",
        description: "当月のシフト管理",
        status: "開発中"
      },
      {
        id: "time-management",
        name: "労働時間管理",
        description: "個人の労働時間や給与確認",
        status: "開発中"
      }
    ]

    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-1">
                <Image
                  src="/logo.png"
                  alt="E-Logistics Logo"
                  width={120}
                  height={40}
                  className="w-[120px] h-[40px] object-contain"
                  priority
                />
                <span className="text-lg font-semibold text-gray-900">Eロジスティクス</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Ver.0.1.0</span>
                <span className="text-sm text-gray-600">
                  ようこそ、{session.user?.name || session.user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white border border-red-600 rounded-md hover:bg-red-700 hover:border-red-700 transition-colors font-medium"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                ダッシュボード
              </h2>
              <p className="text-gray-600">
                利用可能なアプリケーションを選択してください
              </p>
            </div>

            {/* アプリ一覧 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apps.map((app) => (
                <Card key={app.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {app.name}
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{app.status}</span>
                    </CardTitle>
                    <CardDescription>
                      {app.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={() => router.push(`/${app.id}`)}>
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
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Image
                src="/logo.png"
                alt="E-Logistics Logo"
                width={120}
                height={40}
                className="w-[120px] h-[40px] object-contain"
                priority
              />
              <span className="text-lg font-semibold text-gray-900">Eロジスティクス</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500">Ver.0.1.0</span>
            </div>
          </div>
        </div>
      </header>

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
