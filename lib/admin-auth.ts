import {cookies} from 'next/headers';
import {supabaseAdmin} from './supabase-server';
import {digest,equal,randomToken,hex} from './security';
export const PASSWORD_ITERATIONS=600000;
export const ADMIN_COOKIE=process.env.NODE_ENV==='production'?'__Host-tomoca_admin':'tomoca_admin';
export async function passwordHash(password:string,salt:string,iterations=PASSWORD_ITERATIONS){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations,salt:new TextEncoder().encode(salt)},key,256));
}
export async function localAdmin(){
  const token=(await cookies()).get(ADMIN_COOKIE)?.value;
  if(!token||!/^[a-f0-9]{64}$/.test(token))return false;
  const db=supabaseAdmin();
  const {data,error}=await db.from('admin_sessions').select('account_id').eq('id',await digest(token)).gt('expires',Date.now()).maybeSingle();
  if(error)throw new Error('Admin session lookup failed: '+error.message);
  return !!data;
}
export async function adminAccount(){
  const db=supabaseAdmin();
  const {data,error}=await db.from('admin_accounts').select('id,email,salt,password_hash,password_iterations,created').eq('id','primary').maybeSingle();
  if(error)throw new Error('Admin account lookup failed: '+error.message);
  return data as null|{id:string;email:string;salt:string;password_hash:string;password_iterations:number;created:number};
}
export {digest,equal,randomToken as sessionToken};
export const adminDatabase=supabaseAdmin;
