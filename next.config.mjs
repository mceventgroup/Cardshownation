/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Strict mode causes doubled Konva event fires in dev
  experimental: {
    // Next 15.5's segment explorer is unstable here and intermittently breaks
    // app route rendering in dev with React Client Manifest errors.
    devtoolSegmentExplorer: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // react-konva/konva may reference the Node-only `canvas` package while
      // bundling server output. The editor canvas is client-only, so keep that
      // dependency externalized and stubbed to avoid production bundle failures.
      if (Array.isArray(config.externals)) {
        config.externals = [...config.externals, { canvas: 'canvas' }]
      }
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    }
    return config
  },
}

export default nextConfig
