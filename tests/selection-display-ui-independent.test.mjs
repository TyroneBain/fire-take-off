import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {setupSelectionEditor} from '../apps/local/web/selection-editor.mjs';
import {inspectPdfElements,elementAt} from '../apps/local/web/pdf-elements.mjs';

// Original geometry: square body, crossing pipe and a pair of black bars
// separated by a0.2-point white gap. No customer geometry or sampled masks.
function original({fineCollision=false}={}){
 const stream=fineCollision?'0 G 1.5 w 92 92 16 16 re S .65 g 96.1 102 .14 4 re f 0 g 96.38 102 .2 4 re f':'0 G 1.5 w 92 92 16 16 re S 70 100 m 130 100 l S 0 g 95 103 1 2 re f 96.2 103 1 2 re f';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[];for(const [i,o] of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=pdf.length;
 pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
function dom(){
 const nodes=[],ids=new Map(),parent={clientWidth:400,clientHeight:300};
 function decorate(n={}){const listeners=new Map();Object.assign(n,{children:[],style:{setProperty(){}},dataset:{},classList:{toggle(){}},parentElement:parent,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatch(type,fields={}){for(const fn of listeners.get(type)||[])fn({type,button:0,pointerId:1,buttons:type==='pointerup'?0:1,target:this,preventDefault(){},stopPropagation(){},...fields});},setPointerCapture(){},append(...children){this.children.push(...children);},insertBefore(child){this.children.unshift(child);},showModal(){this.open=true;},close(){this.open=false;},click(){if(!this.disabled)return this.onclick?.({shiftKey:false});},getBoundingClientRect(){return{left:20,top:30,width:parseFloat(this.style.width)||this.width,height:parseFloat(this.style.height)||this.height};}});nodes.push(n);return n;}
 return{getElementById(id){const dynamic=nodes.find(n=>n.id===id);if(dynamic)return dynamic;if(!ids.has(id)){const n=decorate(id==='selection-canvas'?createCanvas(1,1):{});n.id=id;ids.set(id,n);}return ids.get(id);},createElement(tag){return decorate(tag==='canvas'?createCanvas(1,1):{});}};
}
const until=async(f,message)=>{for(let n=0;n<400;n++){if(f())return;await new Promise(r=>setTimeout(r,5));}assert.fail(message);};
async function fixture(t,{holdDisplay=false,holdPick=false,failPick=false,fineCollision=false}={}){
 const oldDocument=globalThis.document,oldWindow=globalThis.window,doc=dom(),bytes=original({fineCollision}),tasks=[],writes=[],reviews=[],displayCalls=[],pickCalls=[];let releaseDisplay,releasePick;const displayGate=new Promise(r=>releaseDisplay=r),pickGate=new Promise(r=>releasePick=r);
 const windowListeners=new Map();globalThis.document=doc;globalThis.window={devicePixelRatio:2,addEventListener(type,fn){if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push(fn);},requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:clearTimeout};
 const record={id:'saved-native-display',item_id:'heading',version:3,multiplier:2,example:{drawing_id:'drawing',page:1,bounds:[82,82,118,118],digest:'a'.repeat(64),algorithm:'binary-overlap-rotations-1'}},state={countMarks:[{id:'corrected',item_id:'heading',included:0,reviewed:1}]},before=structuredClone({record,state});
 const pdfjs={OPS,getDocument(){const task=getDocument({data:bytes.slice(),isEvalSupported:false});tasks.push(task);return{promise:task.promise.then(pdf=>({getPage:async n=>{const page=await pdf.getPage(n);return new Proxy(page,{get(target,key){if(key==='render')return options=>{const rendering=page.render(options);if(options.canvas.width===1&&options.canvas.height===1){pickCalls.push(true);if(failPick)return{promise:rendering.promise.then(()=>{throw Error('Owned display picking render failure');}),cancel:()=>rendering.cancel()};if(holdPick)return{promise:rendering.promise.then(()=>pickGate),cancel:()=>rendering.cancel()};}if(options.canvas.width>200){displayCalls.push({width:options.canvas.width,height:options.canvas.height});if(holdDisplay)return{promise:rendering.promise.then(()=>displayGate),cancel:()=>rendering.cancel()};}return rendering;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});}})),destroy:()=>task.destroy()};}};
 const node=id=>doc.getElementById(id),editor=setupSelectionEditor({pdfjs,context:()=>({drawing:{id:'drawing'},state}),apply:async()=>writes.push('apply'),remove:async()=>writes.push('remove'),reviewVector:async(...args)=>reviews.push(args),cancelMatching(){}});
 t.after(async()=>{releaseDisplay();releasePick();editor.close();await Promise.all(tasks.map(task=>task.destroy()));globalThis.document=oldDocument;globalThis.window=oldWindow;});
 await editor.open(record);
 async function settled(){await until(()=>!node('selection-error').textContent&&!node('selection-done').disabled,'Display did not settle: '+node('selection-error').textContent);}
 const canvas=node('selection-canvas');function pointer(type,x,y){const r=canvas.getBoundingClientRect();canvas.dispatch(type,{clientX:r.left+(x-82)/36*r.width,clientY:r.top+(118-y)/36*r.height});}
 async function click(x,y){pointer('pointerdown',x,y);pointer('pointerup',x,y);await settled();}
 const rgba=(x,y)=>[...canvas.getContext('2d').getImageData(Math.floor((x-82)/36*canvas.width),Math.floor((118-y)/36*canvas.height),1,1).data];
 const resize=width=>{canvas.parentElement.clientWidth=width;for(const fn of windowListeners.get('resize')||[])fn();};
 return{editor,node,record,state,before,writes,reviews,canvas,settled,click,pointer,rgba,displayCalls,pickCalls,releaseDisplay,releasePick,tasks,resize};
}

test('native editor renders vector detail at display resolution instead of enlarging its72px picking mask',async t=>{
 const f=await fixture(t);await f.settled();assert.ok(f.canvas.width>=400,'Visible drawing needs a larger independently rendered backing surface');assert.ok(f.displayCalls.length,'Original PDF renderer must receive a display-resolution viewport');
 assert.deepEqual(f.rgba(95.5,104),[0,0,0,255]);assert.deepEqual(f.rgba(96.7,104),[0,0,0,255]);const gap=f.rgba(96.1,104);assert.ok(gap[3]===0||gap.slice(0,3).every(c=>c===255),'The authored0.2-point gap remains visibly white/transparent');
 assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});

test('CSS pointer positions still erase and restore the correct original path on the larger display canvas',async t=>{
 const f=await fixture(t);await f.settled();assert.ok(f.canvas.width>72);assert.equal(f.node('selection-elements').textContent,'4');
 await f.click(86,100);assert.equal(f.node('selection-elements').textContent,'3');f.node('selection-restore').click();await f.click(86,100);assert.equal(f.node('selection-elements').textContent,'4');f.node('selection-erase').click();await f.click(86,100);assert.equal(f.node('selection-elements').textContent,'3');
 const page=await(await f.tasks[0].promise).getPage(1),ops=await page.getOperatorList(),ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]);await f.node('selection-native-review').click();assert.equal(f.reviews.length,1);const selection=f.reviews[0][1];assert.deepEqual(selection.ids,ids);assert.deepEqual(selection.excluded,[ids[1]],'Only the authored crossing pipe is excluded');assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});

test('a pending high-resolution PDF render cannot repaint or enable actions after Cancel',async t=>{
 const f=await fixture(t,{holdDisplay:true});await until(()=>f.displayCalls.length>0,'No high-resolution render started');f.node('selection-cancel').click();const width=f.canvas.width,height=f.canvas.height,pixels=f.canvas.getContext('2d').getImageData(0,0,width,height).data.slice();f.releaseDisplay();await new Promise(r=>setTimeout(r,120));
 assert.equal(f.node('selection-dialog').open,false);assert.equal(f.canvas.width,width);assert.equal(f.canvas.height,height);assert.deepEqual(f.canvas.getContext('2d').getImageData(0,0,width,height).data,pixels);assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);assert.deepEqual(f.reviews,[]);
});


test('resizing rebuilds the native display without dropping exclusions or moving pointer targets',async t=>{
 const f=await fixture(t);await f.settled();await f.click(86,100);assert.equal(f.node('selection-elements').textContent,'3');const oldWidth=f.canvas.width,calls=f.displayCalls.length;f.resize(200);await f.settled();
 assert.ok(f.canvas.width<oldWidth&&f.canvas.width>72);assert.ok(f.displayCalls.length>calls,'A new original-PDF display render is required after resizing');assert.equal(f.node('selection-elements').textContent,'3');
 f.node('selection-restore').click();await f.click(86,100);assert.equal(f.node('selection-elements').textContent,'4');f.node('selection-cancel').click();assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);assert.deepEqual(f.reviews,[]);
});

test('native Erase hides removed pipe pixels while Restore and Shift expose the same recoverable original path',async t=>{
 const f=await fixture(t);await f.settled();assert.deepEqual(f.rgba(86,100),[0,0,0,255]);await f.click(86,100);
 assert.equal(f.node('selection-elements').textContent,'3');assert.equal(f.rgba(86,100)[3],0,'Erased pipe must visibly disappear in Erase mode');
 const assertGhost=()=>{const pixel=f.rgba(86,100);assert.ok(pixel[3]>0&&pixel[3]<255,'Restore must show a translucent ghost');assert.ok(pixel.slice(0,3).every(v=>Math.abs(v-150)<=1),'Ghost stays distinguishable grey');assert.equal(f.node('selection-elements').textContent,'3','Mode switches must not alter exclusions');};
 f.node('selection-restore').click();assertGhost();f.node('selection-erase').click();assert.equal(f.rgba(86,100)[3],0);
 const target={closest:()=>null};f.node('selection-dialog').dispatch('keydown',{key:'Shift',target});assertGhost();f.node('selection-dialog').dispatch('keyup',{key:'Shift',target});assert.equal(f.rgba(86,100)[3],0);
 f.node('selection-restore').click();await f.click(86,100);assert.equal(f.node('selection-elements').textContent,'4');assert.deepEqual(f.rgba(86,100),[0,0,0,255]);
 const page=await(await f.tasks[0].promise).getPage(1),ops=await page.getOperatorList(),ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]);await f.node('selection-native-review').click();assert.equal(f.reviews.length,1);assert.deepEqual(f.reviews[0][1].ids,ids);assert.deepEqual(f.reviews[0][1].excluded,[]);assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});

test('display picking distinguishes authored grey and black paths that collide in one inspection pixel',async t=>{
 const task=getDocument({data:original({fineCollision:true}),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),allocations=[];
 const model=await inspectPdfElements({page,OPS,bounds:[82,82,118,118],nativeReviewOnly:true,createCanvas:(w,h)=>{const canvas=createCanvas(w,h);allocations.push(canvas);return canvas;}}),ids=model.elements.map(e=>e.id),point={x:(96.15-82)/36,y:(118-104)/36,width:560,height:560};
 assert.equal(ids.length,3);assert.equal(elementAt(model.elements,point.x*model.width,point.y*model.height,model.width,model.height),ids[2],'Fixture reproduces the old wrong-black-path hit at the grey point');
 assert.equal(await model.pickDisplayElement(point),ids[1],'Original display paint identifies the fine grey path only');assert.equal(await model.pickDisplayElement({...point,excluded:[ids[1]]}),null,'Removed grey path does not redirect the hit to its nearby black neighbour');
 assert.equal(await model.pickDisplayElement({...point,candidateIds:[ids[1]]}),ids[1]);assert.equal(await model.pickDisplayElement({...point,candidateIds:[ids[2]]}),null);
 assert.equal(await model.pickDisplayElement({...point,x:(96.48-82)/36}),ids[2]);assert.equal(await model.pickDisplayElement({...point,x:(100-82)/36}),null,'Blank space never selects a nearby path');
 assert.deepEqual(model.elements.map(e=>e.id),ids);assert.ok(allocations.every(c=>c.width===0&&c.height===0),'All scratch picking canvases are released');
});

test('a natural fine-grey display click erases and restores its exact ID without changing adjacent black geometry',async t=>{
 const f=await fixture(t,{fineCollision:true});await f.settled();assert.equal(f.node('selection-elements').textContent,'3');const black=f.rgba(96.48,104);assert.deepEqual(black,[0,0,0,255]);assert.ok(f.rgba(96.15,104)[0]>0);
 await f.click(96.15,104);assert.equal(f.node('selection-elements').textContent,'2');assert.equal(f.rgba(96.15,104)[3],0);assert.deepEqual(f.rgba(96.48,104),black,'Adjacent black component remains intact');
 f.node('selection-restore').click();await f.click(96.15,104);assert.equal(f.node('selection-elements').textContent,'3');f.node('selection-erase').click();await f.click(96.15,104);
 const page=await(await f.tasks[0].promise).getPage(1),ops=await page.getOperatorList(),ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]);await f.node('selection-native-review').click();assert.deepEqual(f.reviews[0][1].ids,ids);assert.deepEqual(f.reviews[0][1].excluded,[ids[1]],'Review receives only the independently authored grey path exclusion');assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});

test('display picking rejects invalid budgets and identities and respects cancellation without allocating',async t=>{
 const task=getDocument({data:original({fineCollision:true}),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),allocations=[];let cancelled=false;
 const model=await inspectPdfElements({page,OPS,bounds:[82,82,118,118],nativeReviewOnly:true,cancelled:()=>cancelled,createCanvas:(w,h)=>{const canvas=createCanvas(w,h);allocations.push(canvas);return canvas;}}),point={x:(96.15-82)/36,y:(118-104)/36,width:560,height:560},count=allocations.length,id=model.elements[1].id;
 for(const invalid of [{width:0},{width:2049},{width:1001,height:1000},{width:2.5},{height:NaN}])await assert.rejects(model.pickDisplayElement({...point,...invalid}),/pixel budget/);
 for(const invalid of [{excluded:[999999]},{excluded:[id,id]},{candidateIds:[999999]},{candidateIds:[id,id]},{candidateIds:Array(129).fill(id)}])await assert.rejects(model.pickDisplayElement({...point,...invalid}),/identities/);
 for(const invalid of [{x:-.01},{x:1},{y:1},{y:NaN}])assert.equal(await model.pickDisplayElement({...point,...invalid}),null);
 assert.equal(allocations.length,count);cancelled=true;await assert.rejects(model.pickDisplayElement(point),/cancel/);assert.equal(allocations.length,count);
});

test('Cancel during a pending display hit discards that hit and queued erasures without changing saved state',async t=>{
 const f=await fixture(t,{holdPick:true,fineCollision:true});await f.settled();f.pointer('pointerdown',96.15,104);f.pointer('pointerup',96.15,104);await until(()=>f.pickCalls.length>0,'No display picking render started');f.pointer('pointerdown',96.48,104);f.pointer('pointerup',96.48,104);assert.equal(f.node('selection-done').disabled,true);assert.equal(f.node('selection-native-review').disabled,true);
 f.node('selection-cancel').click();const width=f.canvas.width,height=f.canvas.height,pixels=f.canvas.getContext('2d').getImageData(0,0,width,height).data.slice();f.releasePick();await new Promise(r=>setTimeout(r,120));assert.equal(f.node('selection-dialog').open,false);assert.equal(f.node('selection-elements').textContent,'3');assert.equal(f.pickCalls.length,1,'Queued erasure cannot start after Cancel');assert.equal(f.canvas.width,width);assert.equal(f.canvas.height,height);assert.deepEqual(f.canvas.getContext('2d').getImageData(0,0,width,height).data,pixels);assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);assert.deepEqual(f.reviews,[]);
});

test('a failed original-PDF picking render leaves a visible error and changes no path identities',async t=>{
 const f=await fixture(t,{failPick:true,fineCollision:true});await f.settled();f.pointer('pointerdown',96.15,104);f.pointer('pointerup',96.15,104);await until(()=>f.node('selection-error').textContent==='Owned display picking render failure','Picking failure was hidden or never reported');
 assert.equal(f.node('selection-elements').textContent,'3');assert.equal(f.node('selection-done').disabled,false,'Failed picking must release busy state');assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);assert.deepEqual(f.reviews,[]);assert.deepEqual(f.rgba(96.48,104),[0,0,0,255]);f.node('selection-cancel').click();assert.equal(f.node('selection-dialog').open,false);
});
