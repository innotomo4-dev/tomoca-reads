import type {NextConfig} from 'next';

const dev=process.env.NODE_ENV!=='production';
const csp=[
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `script-src 'self' 'unsafe-inline'${dev?" 'unsafe-eval'":''}`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "form-action 'self'"
].join('; ');

const securityHeaders=[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'X-Permitted-Cross-Domain-Policies',value:'none'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
  {key:'Content-Security-Policy',value:csp},
  ...(dev?[]:[{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}])
];

const nextConfig:NextConfig={
  async headers(){return [{source:'/:path*',headers:securityHeaders}];}
};

export default nextConfig;
