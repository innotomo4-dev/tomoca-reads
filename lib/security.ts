export const hex=(v:ArrayBuffer)=>Array.from(new Uint8Array(v),b=>b.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
export function randomToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return hex(bytes.buffer);}
export function equal(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export function clientAddress(req:Request){
  const forwarded=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded||req.headers.get('x-real-ip')?.trim()||'shared';
}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !!origin&&origin===new URL(req.url).origin;}
