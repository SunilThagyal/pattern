import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // experimental: {
  //   fontLoaders: [ // This is for pages router, app router handles fonts differently.
  //     { loader: 'next/font/google', options: { subsets: ['latin'] } },
  //   ],
  // },
};

export default nextConfig;
