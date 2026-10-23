import {currentAdmin,digest,sessionToken} from '../../../lib/admin-auth';
import {config} from '../../../lib/config';
import {sameOrigin} from '../../../lib/security';
import {supabaseAdmin} from '../../../lib/supabase-server';

export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(){
  try{
    const account=await currentAdmin();
    if(!account)return json({error:'Administrator access required.'},403);
    const db=supabaseAdmin(),now=Date.now();
    const [admins,invitations]=await Promise.all([
      db.from('admin_accounts').select('id,email,created').order('created',{ascending:true}),
      db.from('admin_invitations').select('id,email,created,expires,invited_by').is('used_at',null).gt('expires',now).order('created',{ascending:false})
    ]);
    if(admins.error||invitations.error)throw new Error(admins.error?.message||invitations.error?.message);
    return json({currentAccountId:account.id,admins:admins.data||[],invitations:invitations.data||[]});
  }catch(error){console.error('Admin team lookup failed',error);return json({error:'Unable to load administrator access.'},503);}
}

export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
  try{
    if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Request too large.'},413);
    const account=await currentAdmin();
    if(!account)return json({error:'Administrator access required.'},403);
    const body=await req.json() as {action?:string;email?:string;id?:string};
    const db=supabaseAdmin(),now=Date.now();

    if(body.action==='revoke'){
      const id=String(body.id||'');
      if(!/^[a-f0-9]{64}$/.test(id))return json({error:'Invalid invitation.'},400);
      const {error}=await db.from('admin_invitations').update({used_at:now}).eq('id',id).is('used_at',null);
      if(error)throw new Error(error.message);
      return json({ok:true});
    }

    if(body.action!=='invite')return json({error:'Unknown action.'},400);
    const email=String(body.email||'').trim().toLowerCase();
    if(email.length>254||!EMAIL.test(email))return json({error:'Enter a valid administrator email address.'},400);

    // Reissuing an invitation invalidates any older unused link for the same email.
    const retired=await db.from('admin_invitations').update({used_at:now}).eq('email',email).is('used_at',null);
    if(retired.error)throw new Error(retired.error.message);

    const rawToken=sessionToken(),id=await digest(rawToken),expires=now+48*60*60*1000;
    const {error}=await db.from('admin_invitations').insert({id,email,invited_by:account.id,created:now,expires});
    if(error)throw new Error(error.message);
    const base=(config.siteUrl()||new URL(req.url).origin).replace(/\/+$/,'');
    return json({ok:true,email,expires,activationUrl:`${base}/admin/activate?token=${rawToken}`});
  }catch(error){console.error('Admin invitation failed',error);return json({error:'Unable to create administrator invitation.'},503);}
}
