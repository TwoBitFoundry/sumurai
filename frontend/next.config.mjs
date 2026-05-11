import withSerwistInit from '@serwist/next';

const disableReactCompiler = process.env.NEXT_DISABLE_REACT_COMPILER === 'true';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  reactCompiler: !disableReactCompiler,
};

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  register: false,
  disable: process.env.NODE_ENV !== 'production',
});

export default withSerwist(nextConfig);
