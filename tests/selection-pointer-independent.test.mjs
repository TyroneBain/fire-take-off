import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {setupSelectionEditor} from '../apps/local/web/selection-editor.mjs';

// Independently authored original PDF. Rectangle body, crossing horizontal and
// vertical pipes are distinct original paints. Tests drive registered pointer
// listeners; no Erase All, preseeded exclusions or exact implementation masks.
function original(kind){
 const base='0 G 1.5 w 92 92 16 16 re S ';
 const stream=base+(kind==='duplicate'?'70 100 m 130 100 l S 70 100 m 130 100 l S':kind==='different-colour'?'1 0 0 RG 70 100 m 130 100 l S 0 G 100 70 m 100 130 l S':'70 100 m 130 100 l S 100 70 m 100 130 l S')+(kind==='white-cover'?' 1 g 98 98 4 4 re f':'');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let data='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(data.length);data+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=data.length;data+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(data));
}
function eventDOM(){
 const nodes=[],byId=new Map();
 function decorate(n={}){const listeners=new Map();Object.assign(n,{children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){}},parentElement:{clientWidth:400},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatch(type,fields={}){const event={type,button:0,buttons:type==='pointerup'?0:1,pointerId:1,preventDefault(){},stopPropagation(){},target:this,...fields};for(const fn of listeners.get(type)||[])fn(event);},setPointerCapture(){},append(...v){this.children.push(...v);},insertBefore(n){this.children.unshift(n);},showModal(){this.open=true;},close(){this.open=false;},click(){if(!this.disabled)return this.onclick?.({shiftKey:false});},getBoundingClientRect(){return{left:20,top:30,width:parseFloat(this.style.width)||this.width,height:parseFloat(this.style.height)||this.height};}});nodes.push(n);return n;}
 return{getElementById(id){const dynamic=nodes.find(n=>n.id===id);if(dynamic)return dynamic;if(!byId.has(id)){const n=decorate(id==='selection-canvas'?createCanvas(1,1):{});n.id=id;byId.set(id,n);}return byId.get(id);},createElement(tag){return decorate(tag==='canvas'?createCanvas(1,1):{});}};
}
async function fixture(t,kind){
 const oldDocument=globalThis.document,oldWindow=globalThis.window,doc=eventDOM(),tasks=[],reviews=[],bytes=original(kind);globalThis.document=doc;globalThis.window={addEventListener(){},requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:clearTimeout};
 const node=id=>doc.getElementById(id),record={id:'unsaved:pointer',item_id:'unsaved:heading',draft:{itemName:'Pointer specimen',color:'#168a90',scope:'source',targetItemId:null},example:{drawing_id:'drawing',digest:'a'.repeat(64),page:1,bounds:[82,82,118,118],algorithm:'new-vector-selection'}},before=structuredClone(record),mutations=[];
 const editor=setupSelectionEditor({pdfjs:{OPS,getDocument(){const task=getDocument({data:bytes.slice(),isEvalSupported:false});tasks.push(task);return task;}},context:()=>({drawing:{id:'drawing'},state:{countMarks:[]}}),apply(){mutations.push('apply');},remove(){mutations.push('remove');},cancelMatching(){},reviewVector:async(...args)=>reviews.push(args)});
 t.after(async()=>{editor.close();await Promise.all(tasks.map(task=>task.destroy()));globalThis.document=oldDocument;globalThis.window=oldWindow;});
 async function settled(){const end=performance.now()+5000;while(node('selection-error').textContent){if(performance.now()>end)throw Error(node('selection-error').textContent);await new Promise(r=>setTimeout(r,5));}}
 await editor.open(record);await settled();assert.equal(node('selection-elements').textContent,'3');
 const page=await(await tasks[0].promise).getPage(1),ops=await page.getOperatorList(),ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath&&ops.argsArray[i][0]===OPS.stroke?[i]:[]);assert.equal(ids.length,3);
 function pointer(type,[x,y]){const canvas=node('selection-canvas'),r=canvas.getBoundingClientRect();canvas.dispatch(type,{clientX:r.left+(x-82)/36*r.width,clientY:r.top+(118-y)/36*r.height});}
 async function click(point){pointer('pointerdown',point);pointer('pointerup',point);await settled();}
 async function review(){await node('selection-native-review').click();assert.equal(reviews.length,1);assert.deepEqual(record,before);assert.deepEqual(mutations,[]);return reviews[0][1];}
 return{node,pointer,click,settled,review,ids};
}

test('natural pipe erasing and restoring uses registered pointer events and preserves the symbol body',async t=>{
 const f=await fixture(t);await f.click([86,100]);assert.equal(f.node('selection-elements').textContent,'2');
 f.node('selection-restore').click();await f.click([86,100]);assert.equal(f.node('selection-elements').textContent,'3');
 f.node('selection-erase').click();await f.click([86,100]);await f.click([100,86]);assert.equal(f.node('selection-elements').textContent,'1');
 const result=await f.review();assert.deepEqual(result.ids,f.ids);assert.deepEqual(result.excluded,f.ids.slice(1));
});

test('overlapping centre picks only the visible top path before natural pipe drag',async t=>{
 const f=await fixture(t);await f.click([100,100]);assert.equal(f.node('selection-elements').textContent,'2','Single press at crossing removes the last painted vertical pipe only');
 f.pointer('pointerdown',[84,100]);f.pointer('pointermove',[86,100]);f.pointer('pointermove',[89,100]);f.pointer('pointerup',[89,100]);await f.settled();assert.equal(f.node('selection-elements').textContent,'1');
 const result=await f.review();assert.deepEqual(result.excluded,f.ids.slice(1));
});


test('coincident equal-colour paths erase one per press and can be restored without Erase All',async t=>{
 const f=await fixture(t,'duplicate');await f.click([100,100]);assert.equal(f.node('selection-elements').textContent,'2');await f.click([100,100]);assert.equal(f.node('selection-elements').textContent,'1');await f.click([92,96]);assert.equal(f.node('selection-elements').textContent,'0');
 f.node('selection-restore').click();await f.click([100,100]);assert.equal(f.node('selection-elements').textContent,'1');await f.click([100,100]);assert.equal(f.node('selection-elements').textContent,'2');await f.click([92,96]);assert.equal(f.node('selection-elements').textContent,'3');
 const result=await f.review();assert.deepEqual(result.ids,f.ids);assert.deepEqual(result.excluded,[]);
});

test('white overpaint is not an eraser hit on the original hidden black paths',async t=>{
 const f=await fixture(t,'white-cover');await f.click([100,100]);assert.equal(f.node('selection-elements').textContent,'3');const result=await f.review();assert.deepEqual(result.excluded,[]);
});

test('different-colour crossing selects the visible black path before the hidden red path',async t=>{
 const f=await fixture(t,'different-colour');await f.click([100,100]);assert.equal(f.node('selection-elements').textContent,'2');
 // The preview now exposes red at the same location: a second natural press
 // must remove that revealed path without hunting for another sample point.
 const canvas=f.node('selection-canvas'),pixel=canvas.getContext('2d').getImageData(canvas.width/2,canvas.height/2,1,1).data;assert.deepEqual([...pixel],[255,0,0,255],'Updated preview really exposes the opaque red path');
 await f.click([100,100]);assert.equal(f.node('selection-elements').textContent,'1','Newly revealed red path remains erasable at the same intersection');
 const result=await f.review();assert.deepEqual(result.excluded,f.ids.slice(1));
});
