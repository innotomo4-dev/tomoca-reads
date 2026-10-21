import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {config,requireEnv} from './config';
let client:SupabaseClient|undefined;
export function supabaseAdmin(){
  if(client)return client;
  client=createClient(requireEnv('SUPABASE_URL',config.supabaseUrl()),requireEnv('SUPABASE_SECRET_KEY',config.supabaseSecretKey()),{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{'X-Client-Info':'tomoca-reads-vercel/1.0'}}
  });
  return client;
}
