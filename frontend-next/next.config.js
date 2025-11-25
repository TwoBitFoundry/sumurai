/** @type {import('next').NextConfig} */
const disableReactCompiler = process.env.NEXT_DISABLE_REACT_COMPILER === 'true'

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  reactCompiler: !disableReactCompiler
}

module.exports = nextConfig
