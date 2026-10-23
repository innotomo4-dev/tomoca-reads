import {adminCookieHeader,digest,passwordHash,PASSWORD_ITERATIONS,sessionToken} from '../../../lib/admin-auth';
import {sameOrigin} from '../../../lib/security';
import {supabaseAdmin} from '../../../lib/supabase-server';

export const dynamic='force-dynamic';
const json=(v:unknown,status=200,headers:Record<string,string>={})=>Response.json(v,{status,headers:{'Cache-Control':'no-store',...headers}});

async function invitation(rawToken:string){
  if(!/^[a-f0-9]{64}$/.test(rawToken))return null;
  const id=await digest(rawToken);
  const {data,error}=await supabaseAdmin().from('admin_invitations').select('email,expires,used_at').eq('id',id).is('used_at',null).gt('expires',Date.now()).maybeSingle();
  if(error)throw new Error('Invitation lookup failed: '+error.message);
  return data?{id,email:String(data.email),expires:Number(data.expires)}:null;
}

export async function GET(req:Request){
  try{
    const inv=await invitation(new URL(req.url).searchParams.get('token')||'');
    if(!inv)return json({valid:false,error:'This administrator invitation is invalid, expired, or has already been used.'},404);
    return json({valid:true,email:inv.email,expires:inv.expires});
  }catch(error){console.error(error);return json({valid:false,error:'Unable to validate this invitation.'},503);}
}

export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
  try{
    if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Request too large.'},413);
    const body=await req.json() as {token?:string;password?:string};
    const rawToken=String(body.token||''),password=String(body.password||'');
    if(password.length<14||password.length>256)return json({error:'Use a password of at least 14 characters.'},400);
    const inv=await invitation(rawToken);
    if(!inv)return json({error:'This administrator invitation is invalid, expired, or has already been used.'},410);

    const db=supabaseAdmin(),now=Date.now(),salt=sessionToken();
    const activated=await db.rpc('activate_admin_invitation',{
      p_token_hash:inv.id,
      p_account_id:`admin_${sessionToken().slice(0,24)}`,
      p_salt:salt,
      p_password_hash:await passwordHash(password,salt),
      p_password_iterations:PASSWORD_ITERATIONS,
      p_now:now
    });
    if(activated.error)throw new Error('Administrator activation failed: '+activated.error.message);
    const row=Array.isArray(activated.data)?activated.data[0]:activated.data;
    if(!row?.account_id)return json({error:'This invitation was already used or expired.'},410);

    const token=sessionToken();
    const session=await db.from('admin_sessions').insert({id:await digest(token),account_id:row.account_id,expires:now+8*60*60*1000});
    if(session.error)throw new Error('Admin session creation failed: '+session.error.message);
    return json({ok:true,email:row.admin_email},200,{'Set-Cookie':adminCookieHeader(token,8*60*60)});
  }catch(error){console.error('Admin activation failed',error);return json({error:'Unable to activate this administrator invitation.'},503);}
}
