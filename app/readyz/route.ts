import {supabaseAdmin} from '../../lib/supabase-server';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const {error}=await supabaseAdmin().from('organizations').select('id').limit(1);
    if(error)throw error;
    return Response.json({ok:true,database:'supabase-postgresql'});
  }catch(error){console.error(error);return Response.json({ok:false,database:'unavailable'},{status:503});}
}
