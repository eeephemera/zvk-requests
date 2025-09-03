/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'i.postimg.cc' },
            { protocol: 'https', hostname: 'postimg.cc' },
        ],
    },
    async rewrites() {
        return [
          {
            source: '/api/:path*',
            destination: 'http://localhost:8081/api/:path*',
          },
        ]
    },
};

export default nextConfig; 