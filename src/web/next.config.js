const withTM = require('next-transpile-modules')(['@salesintel/ui-components']); // v10.0.0

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Environment variables exposed to the client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID,
    NEXT_PUBLIC_LINKEDIN_ADS_CLIENT_ID: process.env.NEXT_PUBLIC_LINKEDIN_ADS_CLIENT_ID,
    NEXT_PUBLIC_ANALYTICS_KEY: process.env.NEXT_PUBLIC_ANALYTICS_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN
  },

  // Image optimization configuration
  images: {
    domains: [
      'storage.googleapis.com',
      'platform-logos.s3.amazonaws.com',
      'campaign-assets.cdn.com'
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Optimization settings
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        minChunks: 1,
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10
          },
          commons: {
            test: /[\\/]src[\\/]/,
            priority: -20
          }
        }
      },
      runtimeChunk: 'single'
    };

    // Performance hints
    config.performance = {
      hints: 'warning',
      maxAssetSize: 244000,
      maxEntrypointSize: 244000
    };

    return config;
  },

  // Security headers
  headers: async () => [
    {
      source: '/api/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, must-revalidate'
        },
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on'
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN'
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        }
      ]
    }
  ],

  // Disable "Powered by Next.js" header
  poweredByHeader: false,

  // Enable compression
  compress: true,

  // Enable ETag generation
  generateEtags: true,

  // Supported page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  // Use SWC minifier
  swcMinify: true,

  // Compiler options
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn']
    }
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    legacyBrowsers: false,
    browsersListForSwc: true,
    modularizeImports: {
      lodash: {
        transform: 'lodash/{{member}}'
      }
    }
  }
};

// Export the configuration wrapped with transpile modules
module.exports = withTM(nextConfig);