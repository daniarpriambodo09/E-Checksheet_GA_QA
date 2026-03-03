/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "localhost",
    "10.12.199.79",
    "192.168.1.25",
    "192.168.1.23",
    "192.168.1.27"
  ],
}

console.log("CONFIG LOADED FROM MJS")

export default nextConfig