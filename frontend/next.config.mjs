const disableReactCompiler = process.env.NEXT_DISABLE_REACT_COMPILER === 'true';

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    turbopackFileSystemCacheForBuild: true,
  },
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  ...(process.env.NODE_ENV === 'development' ? { skipTrailingSlashRedirect: true } : {}),
  trailingSlash: true,
  reactCompiler: !disableReactCompiler,
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://localhost:3000/health',
      },
    ];
  },
};

export default nextConfig;
