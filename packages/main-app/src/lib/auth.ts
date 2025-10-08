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
    async jwt({ token, user, account }) {
      if (user) {
        token.id = (user as any).id || token.id
        // Googleでログインした場合は編集可フラグを付与
        if (account?.provider === 'google') {
          ;(token as any).editorVerified = true
        } else if (account?.provider === 'credentials') {
          ;(token as any).editorVerified = false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as string
        ;(session as any).editorVerified = !!(token as any).editorVerified
      }
      return session
    }
  }
}