/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14ではappDirはデフォルトで有効
  // iPhone等のLANアクセス時に/_next配下のアセット取得がCORSと解釈される場合に備えヘッダーを付与
  async headers() {
    return [
      {
        source: '/_next/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Origin, X-Requested-With, Content-Type, Accept' },
        ],
      },
    ]
  },
  // 将来のNext.jsメジャーで必要になる可能性のある設定。
  // 現時点では警告のみだが、許可する開発時オリジンを明示しておく。
  // 値の仕様は今後変更される可能性があるためエラーにはならないよう配慮。
  allowedDevOrigins: [
    'http://localhost:3002',
    'http://127.0.0.1:3002',
  ],
}

module.exports = nextConfig
