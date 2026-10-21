import {isAdmin,rawEdition,sameOrigin} from '../../../lib/server';
import {supabaseAdmin} from '../../../lib/supabase-server';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
  try{
    if(!await isAdmin())return json({error:'Administrator access required.'},403);
    const ed=await rawEdition();
    const saved=await supabaseAdmin().from('story_overrides').select('url,title,summary,hidden,updated');
    if(saved.error)throw new Error(saved.error.message);
    return json({stories:ed.stories,overrides:saved.data||[]});
  }catch(error){console.error(error);return json({error:'Unable to load story controls.'},503);}
}
export async function POST(req:Request){
  if(!sameOrigin(req)||!await isAdmin())return json({error:'Administrator access required.'},403);
  try{
    const b=await req.json() as {url:string;title:string;summary:string;hidden:boolean;reset?:boolean};
    const ed=await rawEdition();
    if(!ed.stories.some((s:any)=>s.url===b.url))return json({error:'This story is no longer in the current edition.'},400);
    if(b.reset){
      const {error}=await supabaseAdmin().from('story_overrides').delete().eq('url',b.url);
      if(error)throw new Error(error.message);
      return json({ok:true});
    }
    if(typeof b.title!=='string'||!b.title.trim()||b.title.length>250||typeof b.summary!=='string'||b.summary.length>500||typeof b.hidden!=='boolean')return json({error:'Use a headline up to 250 characters and a summary up to 500.'},400);
    const {error}=await supabaseAdmin().from('story_overrides').upsert({url:b.url,title:b.title.trim(),summary:b.summary,hidden:b.hidden,updated:Date.now()},{onConflict:'url'});
    if(error)throw new Error(error.message);
    return json({ok:true});
  }catch(error){console.error(error);return json({error:'Unable to save the story.'},503);}
}
