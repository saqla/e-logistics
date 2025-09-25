"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LoginFormProps {
  onSuccess: () => void
  onError: (error: string) => void
}

export function LoginForm({ onSuccess, onError }: LoginFormProps) {
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      console.log("Login attempt:", { userId, hasPassword: !!password })
      const result = await signIn("credentials", {
        email: userId,
        password,
        redirect: false,
      })

      console.log("SignIn result:", result)

      if (result?.error) {
        console.log("Login error:", result.error)
        onError("ユーザーIDまたはパスワードが間違っています")
      } else if (result?.ok) {
        console.log("Login successful")
        onSuccess()
      } else {
        console.log("Login failed - no error but not ok")
        onError("ログインに失敗しました")
      }
    } catch (error) {
      console.log("Login exception:", error)
      onError("ログイン中にエラーが発生しました")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ロゴ */}
      <div className="flex justify-center">
        <Image
          src="/logo.png"
          alt="E-Logistics Logo"
          width={150}
          height={50}
          className="w-[150px] h-[50px] object-contain"
          priority
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="userId">ユーザーID</Label>
          <input
            id="userId"
            type="text"
            placeholder="ユーザーIDを入力"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            autoComplete="username"
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">パスワード</Label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-black placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 rounded-r-md"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          disabled={isLoading}
        >
          {isLoading ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </div>
  )
}