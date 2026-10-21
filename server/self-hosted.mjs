import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,timingSafeEqual,pbkdf2 as derive} from 'node:crypto';
import {promisify} from 'node:util';
import QRCode from 'qrcode';
import {collect,withCoffeeFallback} from '../lib/news.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const origin=new URL(process.env.SITE_URL||`http://127.0.0.1:${port}`).origin;
if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://'))throw Error('Production requires SITE_URL=https://your-domain');
const databasePath=process.env.DATABASE_PATH||path.join(root,'data','tomoca.sqlite');fs.mkdirSync(path.dirname(databasePath),{recursive:true,mode:0o700});
const db=new DatabaseSync(databasePath);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
try{fs.chmodSync(databasePath,0o600);}catch{}
db.exec('CREATE TABLE IF NOT EXISTS selfhost_migrations (name TEXT PRIMARY KEY NOT NULL)');
for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort()){
 if(db.prepare('SELECT name FROM selfhost_migrations WHERE name=?').get(file))continue;
 db.exec('BEGIN');try{db.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));db.prepare('INSERT INTO selfhost_migrations(name) VALUES(?)').run(file);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
const seed=JSON.parse(fs.readFileSync(path.join(root,'lib','seed.json'),'utf8'));
const branches=[{id:'historical',name:'Historical'},{id:'sip',name:'Sip'},{id:'abrehot',name:'Abrehot'}];
const hash=s=>createHash('sha256').update(s).digest('hex'),random=()=>randomBytes(32).toString('hex');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const pbkdf2=promisify(derive),passwordHash=async(p,s)=>(await pbkdf2(p,s,100000,32,'sha256')).toString('hex');
const secure=origin.startsWith('https://'),adminCookie=secure?'__Host-tomoca_admin':'tomoca_admin_dev';
const cookie=(name,value,seconds)=>`${name}=${value}; HttpOnly; ${secure?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=${seconds}`;
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')).filter(p=>p.length===2));
const admin=req=>{const token=cookies(req)[adminCookie];return !!token&&/^[a-f0-9]{64}$/.test(token)&&!!db.prepare('SELECT id FROM admin_sessions WHERE id=? AND expires>?').get(hash(token),Date.now());};
const session=req=>db.prepare('SELECT id,branch,expires FROM sessions WHERE id=? AND expires>?').get(cookies(req).tomoca_session||'',Date.now())||null;
const json=(res,data,status=200,extra={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...extra});res.end(JSON.stringify(data));};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
async function body(req){let total=0;const pieces=[];for await(const part of req){total+=part.length;if(total>16384)throw fail('Request too large.',413);pieces.push(part);}try{return JSON.parse(Buffer.concat(pieces).toString()||'{}');}catch{throw fail('Invalid JSON.');}}
function account(){return db.prepare("SELECT * FROM admin_accounts WHERE id='primary'").get();}
function checkRate(req,email){const window=900000,bucket=Math.floor(Date.now()/window);for(const label of ['ip:'+req.socket.remoteAddress,'email:'+email]){const id=hash(label)+':'+bucket;const row=db.prepare('INSERT INTO admin_login_attempts(id,attempts,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').get(id,(bucket+2)*window);if(row.attempts>8)throw fail('Too many sign-in attempts. Please try again in 15 minutes.',429);}}
let refreshPending=null;
async function rawEdition(refresh=false){const saved=db.prepare("SELECT data,updated FROM editions WHERE id='latest'").get();let current=saved?JSON.parse(saved.data):seed;if(refresh||!saved||Date.now()-saved.updated>3600000){if(!refreshPending)refreshPending=(async()=>{try{const next=await collect();if(next.stories.length>=3){db.prepare("INSERT INTO editions(id,data,updated) VALUES('latest',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated").run(JSON.stringify(next),next.updated);return next;}}catch{console.error('Edition refresh failed; retaining saved edition.');}return withCoffeeFallback(current);})().finally(()=>{refreshPending=null;});current=await refreshPending;}return withCoffeeFallback(current);}
async function edition(refresh=false){const ed=await rawEdition(refresh),overrides=new Map(db.prepare('SELECT * FROM story_overrides').all().map(o=>[o.url,o]));return {...ed,stories:ed.stories.filter(s=>!overrides.get(s.url)?.hidden).map(s=>{const o=overrides.get(s.url);return o?{...s,title:o.title||s.title,summary:o.summary}:s;})};}
async function api(req,res,url){const action=url.pathname.slice(5),isAdmin=admin(req);if(req.method==='GET'){
 if(action==='session')return json(res,{session:session(req),admin:isAdmin,setupAvailable:!account()&&!!process.env.ADMIN_SETUP_TOKEN});
 if(action==='admin-auth'){const a=account();return json(res,{configured:!!a,ownerRecovery:false,...(isAdmin?{email:a?.email}: {})});}
 if(action==='edition'){if(!isAdmin&&!session(req))throw fail('Scan the QR at TOMOCA to start reading.',401);return json(res,await edition());}
 if(!isAdmin)throw fail('Administrator access required.',403);
 if(action==='manage'){const ed=await edition();return json(res,{stats:db.prepare('SELECT branch,COUNT(*) AS sessions FROM sessions GROUP BY branch').all(),registrations:db.prepare('SELECT COUNT(*) AS total,SUM(consent) AS opted_in FROM registrations').get(),health:ed.health,updated:ed.updated,branches,billing:{amount:20,currency:'USD',status:process.env.BILLING_CHECKOUT_URL?'Checkout configured · activation unverified':'Not connected',checkout:process.env.BILLING_CHECKOUT_URL||null,portal:process.env.BILLING_PORTAL_URL||null}});}
 if(action==='qr'){const branch=url.searchParams.get('branch');if(!branches.some(b=>b.id===branch))throw fail('Choose a branch.');const now=Date.now();let code=db.prepare('SELECT id,expires FROM codes WHERE branch=? AND expires>? ORDER BY expires DESC LIMIT 1').get(branch,now+30000);if(!code){code={id:random(),expires:now+300000};db.prepare('INSERT INTO codes(id,branch,expires) VALUES(?,?,?)').run(code.id,branch,code.expires);}const link=origin+'/scan?code='+code.id;return json(res,{image:await QRCode.toDataURL(link,{width:380,margin:2}),expires:code.expires,branch,link});}
 if(action==='news-editor'){return json(res,{stories:(await rawEdition()).stories,overrides:db.prepare('SELECT * FROM story_overrides').all()});}
 throw fail('Not found.',404);
 }
 if(req.method!=='POST')throw fail('Method not allowed.',405);
 if(action==='refresh'&&process.env.UPDATE_SECRET&&equal(req.headers.authorization||'','Bearer '+process.env.UPDATE_SECRET))return json(res,await edition(true));
 if(req.headers.origin!==origin)throw fail('Invalid request origin.',403);
 const b=await body(req);
 if(action==='admin-auth'){
  if(b.action==='logout'){const t=cookies(req)[adminCookie];if(t)db.prepare('DELETE FROM admin_sessions WHERE id=?').run(hash(t));return json(res,{ok:true},200,{'Set-Cookie':cookie(adminCookie,'',0)});}
  const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(email.length>254||password.length>256)throw fail('Invalid credentials.');
  if(b.action==='setup'){checkRate(req,email);const expected=process.env.ADMIN_SETUP_TOKEN;if(account())throw fail('An administrator login already exists.',409);if(!expected||!equal(req.headers.authorization||'','Bearer '+expected))throw fail('A valid setup token is required.',403);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<14)throw fail('Use a valid email and a password of at least 14 characters.');const salt=random(),result=db.prepare("INSERT OR IGNORE INTO admin_accounts(id,email,salt,password_hash,created) VALUES('primary',?,?,?,?)").run(email,salt,await passwordHash(password,salt),Date.now());if(!result.changes)throw fail('An administrator already exists.',409);return json(res,{ok:true});}
  if(b.action!=='login')throw fail('Unknown action.');checkRate(req,email);const a=account(),calculated=await passwordHash(password,a?.salt||'unconfigured-account-salt');if(!a||!equal(email,a.email)||!equal(calculated,a.password_hash))throw fail('Email or password is incorrect, or the login has not been activated.',401);const token=random();db.prepare("INSERT INTO admin_sessions(id,account_id,expires) VALUES(?,'primary',?)").run(hash(token),Date.now()+28800000);db.prepare('DELETE FROM admin_sessions WHERE expires<?').run(Date.now());db.prepare('DELETE FROM admin_login_attempts WHERE expires<?').run(Date.now());return json(res,{ok:true},200,{'Set-Cookie':cookie(adminCookie,token,28800)});
 }
 if(action==='register'){const s=session(req);if(!s)throw fail('Start a reading session first.',401);let phone=String(b.phone||'').replace(/[\s()-]/g,'');if(/^0[79]\d{8}$/.test(phone))phone='+251'+phone.slice(1);if(!/^\+[1-9]\d{7,14}$/.test(phone)||b.consent!==true)throw fail('Use a valid international phone number and select consent.');db.prepare('INSERT INTO registrations(phone,branch,consent,created,notice) VALUES(?,?,?,?,?) ON CONFLICT(phone) DO NOTHING').run(phone,s.branch,1,Date.now(),'TOMOCA news, events and offers · optional · v1');return json(res,{ok:true});}
 if(!isAdmin)throw fail('Administrator access required.',403);
 if(action==='refresh')return json(res,await edition(true));
 if(action==='news-editor'){const ed=await rawEdition();if(!ed.stories.some(s=>s.url===b.url))throw fail('This story is no longer in the current edition.');if(b.reset){db.prepare('DELETE FROM story_overrides WHERE url=?').run(b.url);return json(res,{ok:true});}if(typeof b.title!=='string'||!b.title.trim()||b.title.length>250||typeof b.summary!=='string'||b.summary.length>500||typeof b.hidden!=='boolean')throw fail('Use a headline up to 250 characters and summary up to 500.');db.prepare('INSERT INTO story_overrides(url,title,summary,hidden) VALUES(?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,summary=excluded.summary,hidden=excluded.hidden').run(b.url,b.title.trim(),b.summary,b.hidden?1:0);return json(res,{ok:true});}
 throw fail('Not found.',404);
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const publicRoot=path.join(root,'dist-selfhosted');
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"frame-ancestors 'none'");try{const url=new URL(req.url,origin);if(url.pathname.startsWith('/api/'))return await api(req,res,url);
if(url.pathname==='/scan'){const row=db.prepare('SELECT branch FROM codes WHERE id=? AND expires>?').get(url.searchParams.get('code')||'',Date.now());if(!row){res.writeHead(303,{Location:'/?scan=expired','Cache-Control':'no-store'});return res.end();}const id=random();db.prepare('INSERT INTO sessions(id,branch,created,expires) VALUES(?,?,?,?)').run(id,row.branch,Date.now(),Date.now()+1800000);res.writeHead(303,{Location:'/', 'Cache-Control':'no-store','Set-Cookie':cookie('tomoca_session',id,1800)});return res.end();}
if(req.method!=='GET'&&req.method!=='HEAD')throw fail('Method not allowed.',405);
const decoded=decodeURIComponent(url.pathname);if(decoded.includes('\0'))throw fail('Not found.',404);let file=path.resolve(publicRoot,'.'+decoded);if(!file.startsWith(publicRoot+path.sep))file='';if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile()){if(decoded==='/'||decoded==='/admin'||decoded==='/admin/')file=path.join(publicRoot,'standalone/index.html');else throw fail('Not found.',404);}res.setHeader('Cache-Control',decoded.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache');if(decoded.startsWith('/admin'))res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
}catch(e){if(!res.headersSent)json(res,{error:e.status?e.message:'The service is temporarily unavailable.'},e.status||503);else res.end();}});
server.listen(port,host,()=>console.log(`TOMOCA Reads listening on ${host}:${port}; public origin ${origin}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
