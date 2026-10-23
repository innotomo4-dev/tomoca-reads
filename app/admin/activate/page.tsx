import ActivateAdmin from './activate';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){
  const {token=''}=await searchParams;
  return <ActivateAdmin token={token}/>;
}
