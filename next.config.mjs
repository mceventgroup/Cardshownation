/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Strict mode causes doubled Konva event fires in dev

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
