import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers(){return[{source:"/:path*",headers:[{key:"Permissions-Policy",value:"geolocation=(self)"}]}]},
};

export default nextConfig;
