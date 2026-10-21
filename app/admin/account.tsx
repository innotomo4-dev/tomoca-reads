'use client';
import {useEffect,useState} from 'react';
export default function AdminAccount(){
  const [state,setState]=useState<any>(null),[message,setMessage]=useState('');
  useEffect(()=>{fetch('/api/admin-auth').then(r=>r.json()).then(setState).catch(()=>setMessage('Unable to load account settings.'));},[]);
  async function logout(){await fetch('/api/admin-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});window.location.assign('/admin');}
  return <section className="panel"><span className="eyebrow">PRIVATE ADMIN ACCOUNT</span><h2>Your administrator login.</h2>{state?.authenticated?<><p>Account: <strong>{state.email}</strong></p><p>Your password is stored as a salted PBKDF2 hash. Keep the Vercel activation token private; it cannot create a second administrator after setup.</p><button onClick={logout}>Sign out of admin session</button></>:<p>Loading account settings…</p>}{message&&<p className="notice" role="status">{message}</p>}</section>;
}
