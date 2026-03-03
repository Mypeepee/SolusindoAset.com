/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  images: {
    remotePatterns: [
      // Avatar Google (OAuth)
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "googleusercontent.com",
        pathname: "**",
      },

      // Avatar GitHub
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "**",
      },

      // Gambar lelang dari Kemenkeu
      {
        protocol: "https",
        hostname: "file.lelang.go.id",
        pathname: "/lelang/photo_barang/**",
      },

      // Foto dari Google Drive (thumbnail generator)
      {
        protocol: "https",
        hostname: "drive.google.com",
        pathname: "/thumbnail/**",
      },
      // Foto dari Google Drive dengan /uc?export=view&id=...
      {
        protocol: "https",
        hostname: "drive.google.com",
        pathname: "/uc**",
      },

      // Unsplash
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;