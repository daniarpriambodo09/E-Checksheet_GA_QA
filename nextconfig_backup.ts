import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:3093",
    "http://192.168.1.17:3093",
    "http://192.168.1.3:3093",
    "http://10.12.199.79:3093",
  ],
}

export default nextConfig