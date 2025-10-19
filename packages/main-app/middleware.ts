import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Preview 環境で CANONICAL_HOST が設定されている場合のみ、
// ホストが一致しなければ固定ドメインへリダイレクトします。
export function middleware(req: NextRequest) {
  const canonical = process.env.CANONICAL_HOST
  if (!canonical) return

  const host = req.headers.get('host') || ''
  if (host === canonical) return

  const url = new URL(req.url)
  url.host = canonical
  return NextResponse.redirect(url, 308)
}

// _next 配下や静的アセットは除外
export const config = {
  matcher: ['/((?!_next/|.*\.(?:png|jpg|jpeg|gif|webp|ico|svg|css|js|map|txt)$).*)'],
}


