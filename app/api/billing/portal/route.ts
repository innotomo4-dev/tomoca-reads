import {isAdmin,sameOrigin} from '../../../../lib/server';
import {billingState,stripe} from '../../../../lib/billing';
import {config} from '../../../../lib/config';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
  if(!sameOrigin(req)||!await isAdmin())return json({error:'Administrator access required.'},403);
  try{
    const state=await billingState();
    if(!state.customerId)return json({error:'No Stripe customer exists yet. Start a subscription first.'},400);
    const siteUrl=(config.siteUrl()||new URL(req.url).origin).replace(/\/+$/,'');
    const session=await stripe().billingPortal.sessions.create({customer:state.customerId,return_url:`${siteUrl}/admin`});
    return json({url:session.url});
  }catch(error:any){console.error(error);return json({error:error?.message||'Unable to open the billing portal.'},503);}
}
