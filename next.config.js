/** @type {import('next').NextConfig} */
const nextConfig = {
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
