import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {openStore} from '../apps/local/store.mjs';
import {startApp} from '../apps/local/server.mjs';
import {rotationFixture} from './generate-count-rotation-fixture.mjs';
import {vectorQaFixture} from './vector-qa-fixture.mjs';
import {vectorScaleQaFixture} from './vector-scale-qa-fixture.mjs';
// A separate headless Chrome profile: never attaches to the user's browser/account.
const directory=await mkdtemp(join(tmpdir(),'fire-count-browser-'));let app,chrome,socket;const checks=[],errors=[];
try{
 const large=process.argv.includes('--large'),scale=process.argv.includes('--vector-scale'),text=process.argv.includes('--vector-text'),vector=scale||text||process.argv.includes('--vector'),store=await openStore(join(directory,'data')),p=store.create('project',null,vector?'Vector acceptance':'Rotation acceptance'),t=store.create('takeoff',p.id,'Original revisions'),d=store.create('discipline',t.id,'Sprinklers');
 if(large)await store.importPdf(d.id,'large.pdf',rotationFixture({large:true}).bytes);
 else if(scale)await store.importPdf(d.id,'vector.pdf',vectorScaleQaFixture().bytes);
 else if(text){execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture')]);await store.importPdf(d.id,'vector.pdf',await readFile(join(directory,'fixture','small-vector.pdf')));}
 else if(vector)await store.importPdf(d.id,'vector.pdf',(await vectorQaFixture()).bytes);else for(const revision of [false,true])await store.importPdf(d.id,revision?'revision.pdf':'base.pdf',rotationFixture({revision}).bytes);store.close();
 app=await startApp({directory:join(directory,'data'),port:0});
 chrome=spawn(process.env.FIRE_TEST_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Owned Chrome startup timed out')),15000);let stderr='';chrome.once('error',reject);chrome.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-8000);const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});let seq=0;const pending=new Map();
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timed out: '+method));},60000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const target=await send('Target.createTarget',{url:app.origin}),{sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});await send('Runtime.enable',{},sessionId);
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false},sessionId);
 const source=await readFile(large?'tests/browser/large-count.js':scale?'tests/browser/vector-scale.js':text?'tests/browser/vector-text.js':vector?'tests/browser/vector-preview.js':'tests/browser/count-rotations.js','utf8');checks.push(await evaluate(`(${source})()`));
 const before=await evaluate("(async()=>JSON.stringify(await(await fetch('/api/state')).json()))()");
 await send('Page.reload',{},sessionId);await new Promise(r=>setTimeout(r,700));const after=await evaluate("(async()=>JSON.stringify(await(await fetch('/api/state')).json()))()");if(before!==after)throw Error('Reload changed saved state');
 const report={date:new Date().toISOString(),browser:await send('Browser.getVersion'),checks,reloadUnchanged:true,errors};if(errors.length)throw Error('Browser exceptions: '+errors.join(', '));await mkdir('.local',{recursive:true});await writeFile(large?'.local/large-count-browser.json':scale?'.local/vector-scale-browser.json':text?'.local/vector-text-browser.json':vector?'.local/vector-preview-browser.json':'.local/count-rotation-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 await send('Browser.close').catch(()=>{});
}finally{
 socket?.close();if(chrome&&chrome.exitCode===null){chrome.kill('SIGTERM');await new Promise(r=>{chrome.once('exit',r);setTimeout(r,3000);});}await app?.close();await rm(directory,{recursive:true,force:true});
}
