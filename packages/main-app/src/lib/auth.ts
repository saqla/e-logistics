import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"

const isProduction = process.env.NODE_ENV === 'production'

// 本番では必ず環境変数を使用。開発時のみデフォルトを許容。
const SHARED_USER_ID = isProduction
  ? process.env.SHARED_USER_ID
  : (process.env.SHARED_USER_ID || "kss")

const SHARED_PASSWORD = isProduction
  ? process.env.SHARED_PASSWORD
  : (process.env.SHARED_PASSWORD || "9se2")

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "ユーザーID", type: "text" },
        password: { label: "パスワード", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // 本番で未設定なら認証不可
        if (!SHARED_USER_ID || !SHARED_PASSWORD) {
          return null
        }

        // シンプルな平文比較（必要なら将来ハッシュ化に移行）
        if (credentials.email !== SHARED_USER_ID) return null
        if (credentials.password !== SHARED_PASSWORD) return null

        return {
          id: "shared-user",
          email: credentials.email,
          name: "社内ユーザー"
        }
      }
    }),
    // Google 個別認証（環境変数が揃っている場合のみ有効化）
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        })]
      : [])
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1時間
  },
  pages: {
    signIn: "/", // カスタムログインページ
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // 共有ユーザーのID付与
      if (user) {
        token.id = (user as any).id || token.id
      }

      // editorVerified のリフレッシュ/付与
      const nowSec = Math.floor(Date.now() / 1000)
      const editorUntil = (token as any).editorUntil as number | undefined
      if (editorUntil && nowSec >= editorUntil) {
        ;(token as any).editorVerified = false
        ;(token as any).editorUntil = undefined
      }

      if (account?.provider === 'google') {
        const email = (user as any)?.email || (profile as any)?.email || ''
        const allowedEmails = (process.env.EDITOR_ALLOWED_EMAILS || '').split(',').map(s=>s.trim()).filter(Boolean)
        const allowedDomains = (process.env.EDITOR_ALLOWED_DOMAINS || '').split(',').map(s=>s.trim()).filter(Boolean)
        const emailDomain = email.split('@')[1] || ''
        const emailOk = allowedEmails.length ? allowedEmails.includes(email) : true
        const domainOk = allowedDomains.length ? allowedDomains.includes(emailDomain) : true
        const ok = email && emailOk && domainOk
        ;(token as any).editorVerified = ok
        const hours = Number(process.env.EDITOR_DURATION_HOURS || '8')
        ;(token as any).editorUntil = ok ? nowSec + hours * 3600 : undefined
      } else if (account?.provider === 'credentials') {
        // 社内ユーザー認証では編集フラグは付与しない
        ;(token as any).editorVerified = (token as any).editorVerified || false
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as string
        const nowSec = Math.floor(Date.now() / 1000)
        const editorUntil = (token as any).editorUntil as number | undefined
        const verified = !!(token as any).editorVerified && (!!editorUntil ? nowSec < editorUntil : true)
        ;(session as any).editorVerified = verified
        ;(session as any).editorUntil = editorUntil
      }
      return session
    }
  }
}