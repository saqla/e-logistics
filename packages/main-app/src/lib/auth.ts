import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

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
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1時間
  },
  pages: {
    signIn: "/", // カスタムログインページ
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as string
      }
      return session
    }
  }
}