const get=(name:string)=>process.env[name]?.trim()||'';
export const config={
  siteUrl:()=>get('SITE_URL'),
  supabaseUrl:()=>get('SUPABASE_URL'),
  supabaseSecretKey:()=>get('SUPABASE_SECRET_KEY')||get('SUPABASE_SERVICE_ROLE_KEY'),
  adminSetupToken:()=>get('ADMIN_SETUP_TOKEN'),
  rateLimitSecret:()=>get('RATE_LIMIT_SECRET'),
  cronSecret:()=>get('CRON_SECRET'),
  stripeSecretKey:()=>get('STRIPE_SECRET_KEY'),
  stripeWebhookSecret:()=>get('STRIPE_WEBHOOK_SECRET'),
  stripePriceId:()=>get('STRIPE_PRICE_ID'),
  registrationRetentionDays:()=>Math.max(1,Number(get('REGISTRATION_RETENTION_DAYS')||365)),
  overrideRetentionDays:()=>Math.max(1,Number(get('OVERRIDE_RETENTION_DAYS')||90)),
};
export function requireEnv(name:string,value:string){if(!value)throw new Error(`${name} is not configured`);return value;}
export function requireStrongHex(name:string,value:string){if(!/^[a-f0-9]{64,}$/i.test(value))throw new Error(`${name} must contain at least 32 random bytes encoded as hexadecimal`);return value;}
