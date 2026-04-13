/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "localhost",
    "10.12.199.79",
    "192.168.1.25",
    "192.168.1.23",
    "192.168.1.27",
    "192.168.1.22",
    "192.168.1.18",
    "10.134.26.79",
    "192.168.1.29"
  ],
}

console.log("CONFIG LOADED FROM MJS")

export default nextConfig