import type Stripe from 'stripe';
import {stripe,syncSubscription,ensureOrganization} from '../../../../lib/billing';
import {config,requireEnv} from '../../../../lib/config';
import {supabaseAdmin} from '../../../../lib/supabase-server';
export const dynamic='force-dynamic';
export async function POST(req:Request){
  const signature=req.headers.get('stripe-signature');
  if(!signature)return new Response('Missing Stripe signature',{status:400});
  try{
    const body=await req.text();
    const event=stripe().webhooks.constructEvent(body,signature,requireEnv('STRIPE_WEBHOOK_SECRET',config.stripeWebhookSecret()));
    await ensureOrganization();
    if(event.type==='checkout.session.completed'){
      const session=event.data.object as Stripe.Checkout.Session;
      if(session.metadata?.organization_id!=='tomoca')return Response.json({received:true,ignored:true});
      const customer=typeof session.customer==='string'?session.customer:null;
      const subscription=typeof session.subscription==='string'?session.subscription:null;
      if(customer){
        const {error}=await supabaseAdmin().from('organizations').update({stripe_customer_id:customer,stripe_subscription_id:subscription,updated:Date.now()}).eq('id','tomoca');
        if(error)throw new Error(error.message);
      }
      if(subscription){const sub=await stripe().subscriptions.retrieve(subscription);await syncSubscription(sub);}
    }
    if(event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted'){
      await syncSubscription(event.data.object as Stripe.Subscription);
    }
    if(event.type==='invoice.payment_failed'){
      const invoice=event.data.object as Stripe.Invoice;
      const customer=typeof invoice.customer==='string'?invoice.customer:null;
      if(customer){
        const {error}=await supabaseAdmin().from('organizations').update({subscription_status:'past_due',updated:Date.now()}).eq('stripe_customer_id',customer);
        if(error)throw new Error(error.message);
      }
    }
    return Response.json({received:true});
  }catch(error:any){console.error('Stripe webhook error',error);return new Response(`Webhook error: ${error?.message||'invalid event'}`,{status:400});}
}
