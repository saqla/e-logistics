"use client"

import Image from "next/image"
import { useSession, signOut } from "next-auth/react"

export function SiteHeader() {
  const { data: session, status } = useSession()

  return (
    <header className="bg-white shadow-sm border-b">
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
            <VersionBadge />
            {status === "authenticated" ? (
              <>
                <span className="text-sm text-gray-600">
                  ようこそ、{session?.user?.name || session?.user?.email}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-4 py-2 bg-red-600 text-white border border-red-600 rounded-md hover:bg-red-700 hover:border-red-700 transition-colors font-medium"
                >
                  ログアウト
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

function VersionBadge() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION
  const sha = process.env.NEXT_PUBLIC_GIT_SHA
  const showSha = (process.env.NEXT_PUBLIC_SHOW_SHA || 'false') === 'true'
  const shortSha = sha ? sha.substring(0, 7) : ''
  const label = showSha && shortSha ? `v${version}+${shortSha}` : `v${version}`
  return (
    <span className="text-sm text-gray-500" title={showSha && sha ? sha : undefined}>{label}</span>
  )
}


