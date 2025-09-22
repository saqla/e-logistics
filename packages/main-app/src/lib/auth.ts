import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-here",
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "ユーザーID", type: "text" },
        password: { label: "パスワード", type: "password" }
      },
      async authorize(credentials, req) {
        console.log("=== Auth attempt ===")
        console.log("Credentials:", credentials)
        console.log("Req:", req)

        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials")
          return null
        }

        // 社内共有アカウントの認証
        const SHARED_USER_ID = "kss"
        const SHARED_PASSWORD = "9se2"

        console.log("Environment variables:")
        console.log("SHARED_USER_ID:", process.env.SHARED_USER_ID)
        console.log("SHARED_PASSWORD:", process.env.SHARED_PASSWORD)

        console.log("Expected:", { SHARED_USER_ID, SHARED_PASSWORD })
        console.log("Received:", { email: credentials.email, password: credentials.password })

        // ユーザーIDチェック
        if (credentials.email !== SHARED_USER_ID) {
          console.log("User ID mismatch")
          return null
        }

        // パスワードチェック（プレーンテキスト比較）
        if (credentials.password !== SHARED_PASSWORD) {
          console.log("Password mismatch")
          return null
        }

        console.log("Authentication successful")

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