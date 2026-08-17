import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ["api.qrserver.com"],
  },
  experimental: {
    serverActions: {
      // Sedikit di atas MAX_ATTACHMENT_SIZE_BYTES (15MB, lib/attachments.ts)
      // untuk memberi ruang overhead multipart form-data.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
