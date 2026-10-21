import {createReaderSession,validDailyCode} from '../../lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){
  try{
    const url=new URL(req.url);const code=url.searchParams.get('code')||'';const row=await validDailyCode(code);
    if(!row)return Response.redirect(url.origin+'/?scan=expired',303);
    const session=await createReaderSession(row.branch);
    return new Response(null,{status:303,headers:{Location:url.origin+'/', 'Cache-Control':'no-store','Set-Cookie':`tomoca_session=${session.token}; HttpOnly; ${process.env.NODE_ENV==='production'?'Secure; ':''}SameSite=Lax; Path=/; Max-Age=1800`}});
  }catch(error){console.error(error);return new Response('Unable to start your session. Please try again.',{status:503});}
}
