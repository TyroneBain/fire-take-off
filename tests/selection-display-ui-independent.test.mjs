import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {setupSelectionEditor} from '../apps/local/web/selection-editor.mjs';

// Original geometry: square body, crossing pipe and a pair of black bars
// separated by a0.2-point white gap. No customer geometry or sampled masks.
function original(){
 const stream='0 G 1.5 w 92 92 16 16 re S 70 100 m 130 100 l S 0 g 95 103 1 2 re f 96.2 103 1 2 re f';
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
async function fixture(t,{holdDisplay=false}={}){
 const oldDocument=globalThis.document,oldWindow=globalThis.window,doc=dom(),bytes=original(),tasks=[],writes=[],reviews=[],displayCalls=[];let releaseDisplay;const displayGate=new Promise(r=>releaseDisplay=r);
 const windowListeners=new Map();globalThis.document=doc;globalThis.window={devicePixelRatio:2,addEventListener(type,fn){if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push(fn);},requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:clearTimeout};
 const record={id:'saved-native-display',item_id:'heading',version:3,multiplier:2,example:{drawing_id:'drawing',page:1,bounds:[82,82,118,118],digest:'a'.repeat(64),algorithm:'binary-overlap-rotations-1'}},state={countMarks:[{id:'corrected',item_id:'heading',included:0,reviewed:1}]},before=structuredClone({record,state});
 const pdfjs={OPS,getDocument(){const task=getDocument({data:bytes.slice(),isEvalSupported:false});tasks.push(task);return{promise:task.promise.then(pdf=>({getPage:async n=>{const page=await pdf.getPage(n);return new Proxy(page,{get(target,key){if(key==='render')return options=>{const rendering=page.render(options);if(options.canvas.width>200){displayCalls.push({width:options.canvas.width,height:options.canvas.height});if(holdDisplay)return{promise:rendering.promise.then(()=>displayGate),cancel:()=>rendering.cancel()};}return rendering;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});}})),destroy:()=>task.destroy()};}};
 const node=id=>doc.getElementById(id),editor=setupSelectionEditor({pdfjs,context:()=>({drawing:{id:'drawing'},state}),apply:async()=>writes.push('apply'),remove:async()=>writes.push('remove'),reviewVector:async(...args)=>reviews.push(args),cancelMatching(){}});
 t.after(async()=>{releaseDisplay();editor.close();await Promise.all(tasks.map(task=>task.destroy()));globalThis.document=oldDocument;globalThis.window=oldWindow;});
 await editor.open(record);
 async function settled(){await until(()=>!node('selection-error').textContent&&!node('selection-done').disabled,'Display did not settle: '+node('selection-error').textContent);}
 const canvas=node('selection-canvas');function pointer(type,x,y){const r=canvas.getBoundingClientRect();canvas.dispatch(type,{clientX:r.left+(x-82)/36*r.width,clientY:r.top+(118-y)/36*r.height});}
 async function click(x,y){pointer('pointerdown',x,y);pointer('pointerup',x,y);await settled();}
 const rgba=(x,y)=>[...canvas.getContext('2d').getImageData(Math.floor((x-82)/36*canvas.width),Math.floor((118-y)/36*canvas.height),1,1).data];
 const resize=width=>{canvas.parentElement.clientWidth=width;for(const fn of windowListeners.get('resize')||[])fn();};
 return{editor,node,record,state,before,writes,reviews,canvas,settled,click,rgba,displayCalls,releaseDisplay,tasks,resize};
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
