import {isAdmin,sameOrigin} from '../../../../lib/server';
import {adminAccount} from '../../../../lib/admin-auth';
import {billingState,ensureOrganization,stripe,verifiedMonthlyPrice} from '../../../../lib/billing';
import {config} from '../../../../lib/config';
import {supabaseAdmin} from '../../../../lib/supabase-server';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
  if(!sameOrigin(req)||!await isAdmin())return json({error:'Administrator access required.'},403);
  try{
    await ensureOrganization();
    const account=await adminAccount();if(!account)return json({error:'Administrator account is not configured.'},400);
    const state=await billingState();
    if(state.active)return json({error:'The TOMOCA Reads subscription is already active.'},409);
    if(state.subscriptionId&&!['canceled','incomplete_expired'].includes(state.status))return json({error:'An existing Stripe subscription needs attention. Use Manage subscription instead of starting another one.'},409);
    const price=await verifiedMonthlyPrice();
    let customerId=state.customerId;
    if(!customerId){
      const customer=await stripe().customers.create({email:account.email,name:'TOMOCA',metadata:{organization_id:'tomoca'}});
      customerId=customer.id;
      const {error}=await supabaseAdmin().from('organizations').update({stripe_customer_id:customerId,updated:Date.now()}).eq('id','tomoca');
      if(error)throw new Error(error.message);
    }
    const siteUrl=(config.siteUrl()||new URL(req.url).origin).replace(/\/+$/,'');
    const session=await stripe().checkout.sessions.create({
      mode:'subscription',
      customer:customerId,
      line_items:[{price:price.id,quantity:1}],
      success_url:`${siteUrl}/admin?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${siteUrl}/admin?billing=cancelled`,
      allow_promotion_codes:true,
      metadata:{organization_id:'tomoca'},
      subscription_data:{metadata:{organization_id:'tomoca'}}
    });
    return json({url:session.url});
  }catch(error:any){console.error(error);return json({error:error?.message||'Unable to start Stripe Checkout.'},503);}
}
