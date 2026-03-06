/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.gstatic.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.stripe.com https://www.gstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com https://checkout.stripe.com https://res.cloudinary.com https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://accounts.google.com",
  "form-action 'self' https://checkout.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  isProduction ? 'upgrade-insecure-requests' : '',
].filter(Boolean);

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  poweredByHeader: false,
  eslint: {
    // Existing repo lint debt should not block production builds on App Platform.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    const firebaseHelperHost = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ? `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`
      : null;

    if (!firebaseHelperHost) {
      return [];
    }

    return [
      {
        source: '/__/auth/:path*',
        destination: `${firebaseHelperHost}/__/auth/:path*`,
      },
      {
        source: '/__/firebase/:path*',
        destination: `${firebaseHelperHost}/__/firebase/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '**',
      },
    ],
  },
  
  // Handle Node.js specific modules used by Cloudinary SDK
  webpack: (config) => {
    // Prevent Konva from loading the Node.js canvas module
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    
    // Add a fallback for Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      http: false,
      https: false,
      zlib: false,
      url: false,
      stream: false,
      path: false,
      crypto: false,
      tls: false,
      net: false,
      child_process: false,
    };
    
    return config;
  },
}

module.exports = nextConfig
