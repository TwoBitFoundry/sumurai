/** @type {import('next').NextConfig} */
const disableReactCompiler = process.env.NEXT_DISABLE_REACT_COMPILER === 'true'

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    reactCompiler: !disableReactCompiler
  }
}

module.exports = nextConfig
