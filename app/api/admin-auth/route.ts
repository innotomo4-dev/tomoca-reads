import {adminAccount,passwordHash,digest,equal,sessionToken,ADMIN_COOKIE,PASSWORD_ITERATIONS} from '../../../lib/admin-auth';
import {supabaseAdmin} from '../../../lib/supabase-server';
import {clientAddress,sameOrigin} from '../../../lib/security';
import {config,requireStrongHex} from '../../../lib/config';
import {isAdmin} from '../../../lib/server';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const cookie=(token:string,maxAge:number)=>`${ADMIN_COOKIE}=${token}; HttpOnly; ${process.env.NODE_ENV==='production'?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=${maxAge}`;

export async function GET(){
  try{
    const account=await adminAccount();
    const authenticated=await isAdmin();
    return json({configured:!!account,authenticated,email:authenticated?account?.email||null:null});
  }catch(error){console.error(error);return json({error:'Administrator status is temporarily unavailable.'},503);}
}

export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
  try{
    if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Request too large.'},413);
    const body=await req.json() as {action?:string;email?:string;password?:string;setupToken?:string};
    const db=supabaseAdmin();
    if(body.action==='logout'){
      const cookieValue=req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}=([^;]+)`))?.[1];
      if(cookieValue)await db.from('admin_sessions').delete().eq('id',await digest(cookieValue));
      return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie('',0)}});
    }

    const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
    if(email.length>254||password.length>256)return json({error:'Invalid credentials.'},400);

    if(body.action==='setup'){
      const existing=await adminAccount();
      if(existing)return json({error:'An administrator login already exists.'},409);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<14)return json({error:'Use a valid email and a password of at least 14 characters.'},400);
      const expected=requireStrongHex('ADMIN_SETUP_TOKEN',config.adminSetupToken());
      const supplied=String(body.setupToken||'');
      if(!supplied||!equal(await digest(supplied),await digest(expected)))return json({error:'The activation token is incorrect.'},403);
      const salt=sessionToken();
      const {error}=await db.from('admin_accounts').insert({id:'primary',email,salt,password_hash:await passwordHash(password,salt),password_iterations:PASSWORD_ITERATIONS,created:Date.now()});
      if(error)return json({error:error.code==='23505'?'An administrator login already exists.':'Unable to create administrator login.'},error.code==='23505'?409:503);
      return json({ok:true});
    }

    if(body.action!=='login')return json({error:'Unknown action.'},400);
    const now=Date.now(),windowMs=15*60*1000,bucket=Math.floor(now/windowMs);
    const rateSecret=requireStrongHex('RATE_LIMIT_SECRET',config.rateLimitSecret()||config.adminSetupToken());
    const ip=clientAddress(req);
    const identifiers=[`ip:${ip}`,`email:${email}`];
    for(const value of identifiers){
      const id=await digest(`${rateSecret}:${value}:${bucket}`);
      const attempt=await db.rpc('increment_login_attempt',{p_id:id,p_expires:(bucket+2)*windowMs});
      if(attempt.error)throw new Error('Login limiter failed: '+attempt.error.message);
      if(Number(attempt.data||0)>8)return json({error:'Too many sign-in attempts. Please try again in 15 minutes.'},429);
    }

    const account=await adminAccount();
    const iterations=Number(account?.password_iterations||100000);
    const calculated=await passwordHash(password,account?.salt||'unconfigured-account-salt',iterations);
    if(!account||!equal(email,account.email)||!equal(calculated,account.password_hash))return json({error:'Email or password is incorrect, or the login has not been activated.'},401);

    if(iterations<PASSWORD_ITERATIONS){
      const salt=sessionToken();
      const {error}=await db.from('admin_accounts').update({salt,password_hash:await passwordHash(password,salt),password_iterations:PASSWORD_ITERATIONS}).eq('id','primary');
      if(error)throw new Error('Password migration failed: '+error.message);
    }
    const token=sessionToken();
    const {error}=await db.from('admin_sessions').insert({id:await digest(token),account_id:'primary',expires:now+8*60*60*1000});
    if(error)throw new Error('Admin session creation failed: '+error.message);
    await db.from('admin_sessions').delete().lt('expires',now);
    await db.from('admin_login_attempts').delete().lt('expires',now);
    return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie(token,8*60*60)}});
  }catch(error){console.error('Admin authentication unavailable',error);return json({error:'Sign-in is temporarily unavailable. Please try again.'},503);}
}
