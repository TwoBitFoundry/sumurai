/** @type {import('next').NextConfig} */
const disableReactCompiler = process.env.NEXT_DISABLE_REACT_COMPILER === 'true'

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  experimental: {
    reactCompiler: !disableReactCompiler
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*'
      },
      {
        source: '/health',
        destination: 'http://localhost:3000/health'
      }
    ]
  }
}

module.exports = nextConfig
