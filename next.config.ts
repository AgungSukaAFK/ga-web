import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ["api.qrserver.com"],
  },
  experimental: {
    serverActions: {
      // CATATAN: attachment (PO/MR/BAST/dll) TIDAK lagi lewat body Server
      // Action - di-upload langsung dari browser ke storage VPS pakai
      // signed URL (lihat lib/uploadDirect.ts), karena Vercel Serverless
      // Functions punya hard limit body request 4.5MB yang TIDAK BISA
      // dinaikkan dari sini sama sekali (setting bodySizeLimit di bawah ini
      // cuma berlaku kalau bukan di-deploy ke Vercel). Nilai 20mb di sini
      // cuma jaga-jaga untuk payload Server Action lain yang bukan file.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
