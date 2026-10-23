'use client';
import {useEffect,useState} from 'react';

export default function AdminAccount(){
  const [state,setState]=useState<any>(null),[team,setTeam]=useState<any>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[activationUrl,setActivationUrl]=useState('');

  async function load(){
    try{
      const [authRes,teamRes]=await Promise.all([fetch('/api/admin-auth'),fetch('/api/admin-invitations')]);
      const auth=await authRes.json(),members=await teamRes.json();
      if(!authRes.ok)throw Error(auth.error||'Unable to load account settings.');
      if(!teamRes.ok)throw Error(members.error||'Unable to load administrator team.');
      setState(auth);setTeam(members);setError('');
    }catch(e:any){setError(e.message);}
  }
  useEffect(()=>{load()},[]);

  async function logout(){
    await fetch('/api/admin-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
    window.location.assign('/admin');
  }

  async function invite(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setMessage('');setError('');setActivationUrl('');
    const form=e.currentTarget,fd=new FormData(form),email=String(fd.get('email')||'');
    try{
      const r=await fetch('/api/admin-invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email})});
      const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to create invitation.');
      setActivationUrl(d.activationUrl);setMessage(`Invitation created for ${d.email}. It expires in 48 hours.`);form.reset();await load();
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }

  async function revoke(id:string){
    if(!window.confirm('Revoke this administrator invitation?'))return;
    setError('');setMessage('');
    try{
      const r=await fetch('/api/admin-invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revoke',id})});
      const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to revoke invitation.');
      setMessage('Invitation revoked.');await load();
    }catch(e:any){setError(e.message);}
  }

  async function copyLink(){
    try{await navigator.clipboard.writeText(activationUrl);setMessage('Activation link copied.');}
    catch{setMessage('Copy the activation link manually from the field below.');}
  }

  return <section className="panel"><span className="eyebrow">ADMINISTRATOR ACCESS</span><h2>Manage the TOMOCA Reads admin team.</h2>{state?.authenticated?<><p>Signed in as <strong>{state.email}</strong>.</p><p>Invite another administrator with a one-time link. The link expires after 48 hours and is invalidated as soon as it is used. Reissuing an invitation for the same email invalidates the previous link.</p>

  <form className="account-form" onSubmit={invite}><label>Administrator email<input name="email" type="email" autoComplete="off" maxLength={254} placeholder="name@tomocacoffee.com" required/></label><button className="primary" disabled={busy}>{busy?'Creating invitation…':'Create administrator invitation'}</button></form>

  {activationUrl&&<div className="activation-link"><label>One-time activation link<input value={activationUrl} readOnly onFocus={e=>e.currentTarget.select()}/></label><button type="button" onClick={copyLink}>Copy activation link</button><p className="small">Send this link directly to the intended administrator. Do not post it publicly.</p></div>}

  {message&&<p className="notice" role="status">{message}</p>}{error&&<p className="notice" role="alert">{error}</p>}

  <h3>Active administrators</h3>{team?.admins?.length?<table><thead><tr><th>Email</th><th>Created</th></tr></thead><tbody>{team.admins.map((a:any)=><tr key={a.id}><td>{a.email}{a.id===team.currentAccountId?' · You':''}</td><td>{new Date(Number(a.created)).toLocaleDateString('en-GB')}</td></tr>)}</tbody></table>:<p className="small">Loading administrators…</p>}

  <h3>Pending invitations</h3>{team?.invitations?.length?<table><thead><tr><th>Email</th><th>Expires</th><th></th></tr></thead><tbody>{team.invitations.map((i:any)=><tr key={i.id}><td>{i.email}</td><td>{new Date(Number(i.expires)).toLocaleString('en-GB',{timeZone:'Africa/Addis_Ababa'})} EAT</td><td><button type="button" onClick={()=>revoke(i.id)}>Revoke</button></td></tr>)}</tbody></table>:<p className="small">No pending administrator invitations.</p>}

  <button type="button" onClick={logout}>Sign out of admin session</button></>:<p>Loading account settings…</p>}</section>;
}
