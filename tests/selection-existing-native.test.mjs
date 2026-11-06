import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {setupSelectionEditor} from '../apps/local/web/selection-editor.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';

// Original clipped drawing with a hollow body, dark centre and crossing line.
// Its saved raster example has no constituent IDs to migrate or discard.
function original(){
 const content='q 30 30 70 70 re W n 0 G 1 w 48 48 24 24 re S 0 g 57 57 6 6 re f 38 60 m 82 60 l S Q';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 120] /Resources << >> /Contents 4 0 R >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[];for(const [i,o]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=pdf.length;
 pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
function decorate(node={}){return Object.assign(node,{style:{},classList:{toggle(){}},parentElement:{clientWidth:400},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},click(){if(!this.disabled)return this.onclick?.({shiftKey:false});}});}
async function fixture(t,algorithm){
 const oldDocument=globalThis.document,oldWindow=globalThis.window,nodes=new Map(),tasks=[],reviews=[],writes=[],bytes=original();
 const node=id=>{if(!nodes.has(id))nodes.set(id,decorate(id==='selection-canvas'?createCanvas(1,1):{}));return nodes.get(id);};
 globalThis.document={getElementById:node,createElement:tag=>{assert.equal(tag,'canvas');return createCanvas(1,1);}};globalThis.window={addEventListener(){},requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:clearTimeout};
 const record={id:'saved-raster',item_id:'heading',version:4,multiplier:2,example:{drawing_id:'drawing',page:1,bounds:[36,40,84,80],digest:'a'.repeat(64),algorithm}},state={countMarks:[{id:'manual-correction',item_id:'heading',example_id:'saved-raster',drawing_id:'drawing',included:0,reviewed:1,quantity:0}]},before=structuredClone({record,state});
 const editor=setupSelectionEditor({pdfjs:{OPS,getDocument(){const task=getDocument({data:bytes.slice(),isEvalSupported:false});tasks.push(task);return task;}},context:()=>({state,drawing:{id:'drawing'}}),apply:async()=>writes.push('apply'),remove:async()=>writes.push('remove'),cancelMatching(){},reviewVector:async(...args)=>reviews.push(args)});
 t.after(async()=>{editor.close();await Promise.all(tasks.map(task=>task.destroy()));globalThis.document=oldDocument;globalThis.window=oldWindow;});
 async function ready(){for(let n=0;n<200;n++){if(!node('selection-done').disabled)return;await new Promise(r=>setTimeout(r,5));}assert.fail('Selection did not become visible/ready: '+node('selection-error').textContent);}
 return{editor,record,state,before,node,tasks,reviews,writes,ready};
}
for(const algorithm of ['binary-overlap-1','binary-overlap-2','binary-overlap-rotations-1'])test(`saved ${algorithm} selection opens visible native geometry directly without changing stored work`,async t=>{
 const f=await fixture(t,algorithm);await f.editor.open(f.record);
 assert.equal(f.node('selection-error').textContent.includes('clipped or composited'),false,'Must not require a second hidden native-inspection action');await f.ready();
 assert.equal(f.node('selection-native-layer').checked,false,'A raster example has no prior native layer choice');assert.equal(f.node('selection-elements').textContent,'3');assert.equal(f.node('selection-done').textContent,'Review matches');assert.equal(f.node('selection-vector').disabled,true);assert.equal(f.tasks.length,1);
 const c=f.node('selection-canvas'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;assert.ok(pixels.some((v,i)=>i%4===3&&v>0),'actual symbol paint must exist in displayed canvas');
 assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);assert.deepEqual(f.reviews,[]);f.node('selection-cancel').click();assert.equal(f.node('selection-dialog').open,false);assert.deepEqual({record:f.record,state:f.state},f.before);
});
test('existing cleaned legacy identity keeps its explicit native retry instead of silent reinterpretation',async t=>{
 const f=await fixture(t,'binary-elements-2'),probe=getDocument({data:original(),isEvalSupported:false});try{const ops=await(await(await probe.promise).getPage(1)).getOperatorList(),ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath&&[OPS.fill,OPS.stroke].includes(ops.argsArray[i][0])?[i]:[]);f.record.example.elements={renderer:ELEMENT_RENDERER,ids,excluded:[ids.at(-1)]};}finally{await probe.destroy();}
 const before=structuredClone(f.record);await f.editor.open(f.record);assert.match(f.node('selection-error').textContent,/clipped or composited/);assert.equal(f.node('selection-done').disabled,true);assert.equal(f.node('selection-native-review').textContent,'Inspect visible vector elements');assert.deepEqual(f.record,before);assert.deepEqual(f.writes,[]);
});
test('explicit appearance selection retains its unsupported-element-cleaning state',async t=>{
 const f=await fixture(t,'appearance-rgb-1');await f.editor.open(f.record);assert.equal(f.tasks.length,0);assert.match(f.node('selection-error').textContent,/do not support element cleaning/);assert.equal(f.node('selection-done').disabled,true);assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});
