/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Strict mode causes doubled Konva event fires in dev

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Konva's Node.js build optionally requires the 'canvas' package for SSR.
      // We never SSR the canvas (it's loaded via dynamic() with ssr:false), so
      // stub the import out entirely to prevent the "Can't resolve 'canvas'" error.
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      }
    }
    return config
  },
}

export default nextConfig
