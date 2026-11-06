import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {extractVectorPage,createVectorTemplate} from '../apps/local/web/vector-recognition.mjs';
import {setupSelectionEditor} from '../apps/local/web/selection-editor.mjs';
import {prepareVectorPattern,releaseVectorPattern} from '../apps/local/web/vector-pattern-review.mjs';
import {runSavedVectorPageSetReview} from '../apps/local/web/vector-page-set-runner.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';

// Independent original PDF: complete square and centre, two distinct crossing
// pipes, plus one fully contained grey detail for deliberate manual exclusion.
function original({paintIssue=false}={}){
 const stream=paintIssue?`0 G 1.5 w 92 92 16 16 re S ${paintIssue==='hollow-black'?'0 g 96 96 8 8 re f':'.5 g 98 98 4 4 re f'} 1 g 97.5 97.5 5 5 re f 0 g 86 86 2 2 re f 0 g 104 104 2 2 re f`:'0 G 1.5 w 92 92 16 16 re S 70 100 m 130 100 l S 100 70 m 100 130 l S .5 g 86 86 2 2 re f 0 g 98 98 4 4 re f';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];let pdf='%PDF-1.4\n',offsets=[];
 for(const [i,o] of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=pdf.length;pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
const bounds=[82,82,118,118],anchor=[100,100];
async function source(t,{paintIssue=false}={}){const task=getDocument({data:original({paintIssue}),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),operatorList=await page.getOperatorList(),allIds=operatorList.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]),ids=paintIssue?allIds.filter((_,i)=>i!==2):allIds,geometry=extractVectorPage({operatorList,OPS});if(!paintIssue)assert.equal(geometry.supported,true);assert.equal(ids.length,paintIssue?4:5);return{ids,geometry};}
async function preparePaint(t,{selection,paintIssue=true,createCanvas:canvasFactory=createCanvas,...options}={}){
 const task=getDocument({data:original({paintIssue}),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,page=await doc.getPage(1),operatorList=await page.getOperatorList(),allIds=operatorList.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]),ids=allIds.filter((_,i)=>i!==2),saved=selection??{page:1,bounds:[...bounds],anchor:[...anchor],ids,excluded:[]};
 const result=await prepareVectorPattern({page,OPS,pdfjsVersion:version,optionalContentConfig:await doc.getOptionalContentConfig(),documentSha256:'a'.repeat(64),selection:saved,createCanvas:canvasFactory,...options});if(result.pattern)releaseVectorPattern(result.pattern);return{result,ids,saved};
}
function dom(){const nodes=[],ids=new Map();function decorate(n={}){const listeners=new Map();Object.assign(n,{children:[],dataset:{},style:{setProperty(){}},classList:{toggle(){}},parentElement:{clientWidth:400},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatch(type,fields={}){for(const fn of listeners.get(type)||[])fn({type,button:0,buttons:type==='pointerup'?0:1,pointerId:1,target:this,preventDefault(){},stopPropagation(){},...fields});},setPointerCapture(){},append(...children){this.children.push(...children);},insertBefore(child){this.children.unshift(child);},showModal(){this.open=true;},close(){this.open=false;},click(){if(!this.disabled)return this.onclick?.({shiftKey:false});},getBoundingClientRect(){return{left:10,top:20,width:parseFloat(this.style.width)||this.width,height:parseFloat(this.style.height)||this.height};}});nodes.push(n);return n;}return{getElementById(id){const dynamic=nodes.find(n=>n.id===id);if(dynamic)return dynamic;if(!ids.has(id)){const n=decorate(id==='selection-canvas'?createCanvas(1,1):{});n.id=id;ids.set(id,n);}return ids.get(id);},createElement:tag=>decorate(tag==='canvas'?createCanvas(1,1):{})};}
const until=async(fn,message)=>{for(let i=0;i<500;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail(message);};
async function editorFixture(t,{invalid=false,paintIssue=false,failure}={}){
 const s=await source(t,{paintIssue}),oldDocument=globalThis.document,oldWindow=globalThis.window,doc=dom(),tasks=[],calls=[],writes=[],state={countMarks:[{id:'kept-correction',included:0,reviewed:1}]},record={id:'saved-boundary',item_id:'heading',version:3,example:{drawing_id:'drawing',page:1,bounds:[...bounds],digest:'a'.repeat(64),algorithm:'binary-overlap-rotations-1'}},before=structuredClone({state,record});
 globalThis.document=doc;globalThis.window={devicePixelRatio:1,addEventListener(){},requestAnimationFrame:fn=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout};const node=id=>doc.getElementById(id);
 const editor=setupSelectionEditor({pdfjs:{OPS,getDocument(){const task=getDocument({data:original({paintIssue}),isEvalSupported:false});tasks.push(task);return task;}},context:()=>({state,drawing:{id:'drawing'}}),apply:async()=>writes.push('apply'),remove:async()=>writes.push('remove'),cancelMatching(){},reviewVector:async(_,selection)=>{calls.push(structuredClone(selection));if(failure)throw await failure(selection,s);if(paintIssue){const {result}=await preparePaint(t,{paintIssue,selection:{...selection,page:1,bounds:[...bounds],anchor:[...anchor]}});if(!result.completed)throw Object.assign(Error(result.reason),result);return;}const result=createVectorTemplate(s.geometry,{bounds,anchor,ids:selection.ids,excluded:selection.excluded});if(!result.supported){const error=new Error(result.reason);error.code='VECTOR_SOURCE_BOUNDARY';error.crossingElementIds=invalid?[s.ids[1],999999]:[s.ids[1],s.ids[2]].filter(id=>!selection.excluded.includes(id));throw error;}}});
 t.after(async()=>{editor.close();await Promise.all(tasks.map(task=>task.destroy()));globalThis.document=oldDocument;globalThis.window=oldWindow;});await editor.open(record);
 async function settled(){await until(()=>!node('selection-error').textContent&&!node('selection-done').disabled,'Editor preview did not settle');}await settled();
 async function click(x,y){const canvas=node('selection-canvas'),r=canvas.getBoundingClientRect();for(const type of ['pointerdown','pointerup'])canvas.dispatch(type,{clientX:r.left+(x-82)/36*r.width,clientY:r.top+(118-y)/36*r.height});await settled();}
 return{...s,node,editor,state,record,before,calls,writes,settled,click};
}

test('source boundary rejection reports only retained original IDs without changing its strict containment decision',async t=>{
 const {ids,geometry}=await source(t),saved={bounds:[...bounds],anchor:[...anchor],ids:[...ids],excluded:[ids[3]]},before=structuredClone({saved,geometry});
 const result=createVectorTemplate(geometry,saved);assert.equal(result.supported,false);assert.match(result.reason,/cuts a vector path/);assert.equal(result.code,'VECTOR_SOURCE_BOUNDARY');assert.deepEqual(result.crossingElementIds,[ids[1],ids[2]]);assert.deepEqual({saved,geometry},before);
 const one=createVectorTemplate(geometry,{...saved,excluded:[ids[1],ids[3]]});assert.equal(one.supported,false);assert.deepEqual(one.crossingElementIds,[ids[2]]);
 const cleaned=createVectorTemplate(geometry,{...saved,excluded:[ids[1],ids[2],ids[3]]});assert.equal(cleaned.supported,true);assert.deepEqual(cleaned.elements.map(e=>e.id),[ids[0],ids[4]]);assert.deepEqual(cleaned.bounds,bounds);assert.deepEqual(cleaned.anchor,anchor);
});

test('boundary action is explicit and Undo restores only its removals while keeping other manual edits and saved state',async t=>{
 const f=await editorFixture(t);await f.click(87,87);assert.equal(f.node('selection-elements').textContent,'4');await f.node('selection-native-review').click();assert.equal(f.calls.length,1);assert.equal(f.node('selection-dialog').open,true);assert.equal(f.node('selection-crossing-paths').hidden,false);assert.equal(f.node('selection-elements').textContent,'4','Refusal must not automatically erase anything');assert.deepEqual(f.calls[0].excluded,[f.ids[3]]);
 f.node('selection-crossing-paths').click();await f.settled();assert.equal(f.node('selection-elements').textContent,'2');assert.equal(f.calls.length,1,'Explicit cleanup must not auto-run Find');assert.deepEqual(f.writes,[]);
 await f.click(100,100);assert.equal(f.node('selection-elements').textContent,'1');f.node('selection-crossing-undo').click();await f.settled();assert.equal(f.node('selection-elements').textContent,'3','Undo restores the two crossing paths, not manual centre/grey exclusions');await f.node('selection-native-review').click();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].excluded,[f.ids[3],f.ids[4]]);
 f.node('selection-cancel').click();assert.equal(f.node('selection-dialog').open,false);assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});

test('unknown diagnostic path IDs cannot enable a bulk exclusion action',async t=>{
 const f=await editorFixture(t,{invalid:true});await f.node('selection-native-review').click();assert.equal(f.node('selection-elements').textContent,'5');assert.notEqual(f.node('selection-crossing-paths').hidden,false);assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});

test('strict source paint diagnosis names the authored grey path covered by white without changing exclusions',async t=>{
 const {result,ids,saved}=await preparePaint(t);assert.equal(result.completed,false);assert.equal(result.code,'VECTOR_SOURCE_PAINT');assert.deepEqual(result.unverifiedElementIds,[ids[1]],'Only the covered grey component fails individual original-paint proof');assert.deepEqual(saved.excluded,[]);assert.deepEqual(result.proposals,[]);
 const cleaned=await preparePaint(t,{selection:{...saved,excluded:[ids[1]]}});assert.equal(cleaned.result.completed,true);assert.deepEqual(cleaned.result.source.elementIds,[ids[0],ids[2],ids[3]]);assert.deepEqual(cleaned.result.source.excludedIds,[ids[1]]);assert.equal(cleaned.result.source.visibility.verified,true);
});

test('unverified paint exclusion requires an explicit action and Undo preserves other manual corrections',async t=>{
 const f=await editorFixture(t,{paintIssue:true});assert.equal(f.node('selection-elements').textContent,'4');await f.click(100,100);assert.equal(f.node('selection-elements').textContent,'4','Clicking the white cover must not erase hidden geometry');await f.click(87,87);assert.equal(f.node('selection-elements').textContent,'3');await f.node('selection-native-review').click();
 assert.equal(f.calls.length,1);assert.equal(f.node('selection-elements').textContent,'3','Failed proof does not auto-remove the grey path');assert.deepEqual(f.calls[0].excluded,[f.ids[2]]);assert.equal(f.node('selection-crossing-paths').hidden,false);assert.equal(f.node('selection-crossing-paths').textContent,'Exclude 1 unverified path');assert.deepEqual(f.writes,[]);
 f.node('selection-crossing-paths').click();await f.settled();assert.equal(f.node('selection-elements').textContent,'2');assert.equal(f.calls.length,1,'Explicit exclusion must not auto-run Find');await f.click(105,105);assert.equal(f.node('selection-elements').textContent,'1');f.node('selection-crossing-undo').click();await f.settled();assert.equal(f.node('selection-elements').textContent,'2');await f.node('selection-native-review').click();assert.deepEqual(f.calls[1].excluded,[f.ids[2],f.ids[3]],'Undo only restores the diagnostic grey exclusion');
 f.node('selection-cancel').click();assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});

test('cancelled and operationally failed source paint diagnosis returns no actionable path IDs',async t=>{
 let cancelled=false;const stop=await preparePaint(t,{cancelled:()=>cancelled,progress:p=>{if(p.phase==='source-paint-diagnosis')cancelled=true;}});assert.equal(stop.result.completed,false);assert.match(stop.result.reason,/cancel/);assert.equal(stop.result.code,undefined);assert.equal(stop.result.unverifiedElementIds,undefined);
 let diagnosing=false;const broken=await preparePaint(t,{progress:p=>{if(p.phase==='source-paint-diagnosis')diagnosing=true;},createCanvas:(w,h)=>{if(diagnosing)throw Error('Owned diagnostic canvas failure');return createCanvas(w,h);}});assert.equal(broken.result.completed,false);assert.match(broken.result.reason,/Owned diagnostic canvas failure/);assert.equal(broken.result.code,undefined);assert.equal(broken.result.unverifiedElementIds,undefined);
});

test('cancelled and operational failures do not enable an unverified-path exclusion control',async t=>{
 for(const message of ['Pattern review cancelled; no results published','Original paint rendering failed: Owned failure'])await t.test(message,async child=>{
  const f=await editorFixture(child,{paintIssue:true,failure:()=>Error(message)});await f.node('selection-native-review').click();assert.equal(f.node('selection-elements').textContent,'4');assert.notEqual(f.node('selection-crossing-paths').hidden,false);assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
 });
});

test('paint diagnosis rejects unknown, duplicate and already-excluded path IDs before offering bulk edits',async t=>{
 for(const kind of ['unknown','duplicate','already-excluded'])await t.test(kind,async child=>{
  const f=await editorFixture(child,{paintIssue:true,failure:(selection,s)=>Object.assign(Error('Original source paint does not verify'),{code:'VECTOR_SOURCE_PAINT',unverifiedElementIds:kind==='unknown'?[s.ids[1],999999]:kind==='duplicate'?[s.ids[1],s.ids[1]]:[s.ids[2]]})});if(kind==='already-excluded')await f.click(87,87);await f.node('selection-native-review').click();assert.equal(f.node('selection-elements').textContent,kind==='already-excluded'?'3':'4');assert.notEqual(f.node('selection-crossing-paths').hidden,false);assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
 });
});

test('legitimate black geometry hollowed by white paint stays intact when strict proof asks for review',async t=>{
 const f=await editorFixture(t,{paintIssue:'hollow-black'}),canvas=f.node('selection-canvas'),pixel=(x,y)=>[...canvas.getContext('2d').getImageData(Math.floor((x-82)/36*canvas.width),Math.floor((118-y)/36*canvas.height),1,1).data];
 assert.deepEqual(pixel(96.5,100),[0,0,0,255]);const hole=pixel(100,100);assert.ok(hole[3]===0||hole.slice(0,3).every(v=>v===255));await f.node('selection-native-review').click();assert.equal(f.node('selection-dialog').open,true);assert.equal(f.node('selection-elements').textContent,'4','A potentially legitimate hollow symbol must never be auto-simplified');assert.deepEqual(f.calls[0].excluded,[]);assert.deepEqual(pixel(96.5,100),[0,0,0,255]);assert.deepEqual(pixel(100,100),hole);assert.equal(f.node('selection-crossing-paths').textContent,'Exclude 1 unverified path');f.node('selection-cancel').click();assert.deepEqual({record:f.record,state:f.state},f.before);assert.deepEqual(f.writes,[]);
});

test('real page-set runner forwards exact failed source IDs and succeeds only after explicit exclusion',async t=>{
 const {ids}=await source(t,{paintIssue:true}),bytes=original({paintIssue:true}),digest=createHash('sha256').update(bytes).digest('hex'),drawing={id:'owned-hidden-paint',digest},example={drawing_id:drawing.id,digest,page:1,bounds:[...bounds],elements:{renderer:ELEMENT_RENDERER,ids,excluded:[]}},before=structuredClone(example),events=[];
 const pdfjs={OPS,version,getDocument(options){const task=getDocument(options);events.push('open');return{promise:task.promise,destroy:async()=>{await task.destroy();events.push('destroy');}};}},args={pdfjs,sourceDrawing:drawing,sourceData:bytes,example,targets:[{drawing,page:1}],layerPolicy:'all-admitted',createCanvas};
 await assert.rejects(runSavedVectorPageSetReview(args),error=>{assert.equal(error.code,'VECTOR_SOURCE_PAINT');assert.deepEqual(error.unverifiedElementIds,[ids[1]]);return true;});assert.deepEqual(example,before);assert.equal(events.filter(v=>v==='open').length,events.filter(v=>v==='destroy').length);
 const report=await runSavedVectorPageSetReview({...args,example:{...example,elements:{...example.elements,excluded:[ids[1]]}}});assert.equal(report.completed,true);assert.equal(report.totals.proposals,1);assert.equal(report.totals.verifiedElementIds,3);assert.deepEqual(report.selection.excluded,[ids[1]]);assert.deepEqual(example,before);assert.equal(events.filter(v=>v==='open').length,events.filter(v=>v==='destroy').length);
});
