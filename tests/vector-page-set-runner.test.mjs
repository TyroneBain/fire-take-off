import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {inkImage,exampleImage} from '../apps/local/web/matcher.mjs';
import {runSavedVectorPageSetReview} from '../apps/local/web/vector-page-set-runner.mjs';

// Independently authored literal PDFs with matching heads, an explicitly
// excluded source pipe and same-layer red centre negatives on every page.
const head=(x,red=false)=>`/OC /Symbols BDC q 1 0 0 1 ${x} 40 cm 0 G 0 g 1 w -4 -4 8 8 re S ${red?'1 0 0 rg':''} -1 -1 2 2 re f Q EMC`;
function pdf(contents){
 const layer=3+contents.length*2,objects=[`<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [${layer} 0 R] /D << /ON [${layer} 0 R] >> >> >>`,`<< /Type /Pages /Kids [${contents.map((_,i)=>`${3+2*i} 0 R`).join(' ')}] /Count ${contents.length} >>`];
 for(const [i,content]of contents.entries())objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 220 100] /Resources << /Properties << /Symbols ${layer} 0 R >> >> /Contents ${4+2*i} 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
 objects.push('<< /Type /OCG /Name (Original page-set fixture heads) >>');let data='%PDF-1.7\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const at=Buffer.byteLength(data);data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`;return new Uint8Array(Buffer.from(data));
}
async function fixture(){
 const bytesA=pdf([`${head(40)} /OC /Symbols BDC 0 G 1 w 40 44 m 40 70 l S EMC ${head(100)} ${head(160,true)}`,`${head(70)} ${head(130)} ${head(190,true)}`]),bytesB=pdf([`${head(50)} ${head(110)} ${head(170,true)}`]),digest=b=>createHash('sha256').update(b).digest('hex'),a={id:'drawing-a',digest:digest(bytesA)},b={id:'drawing-b',digest:digest(bytesB)},bytesById=new Map([[a.id,bytesA],[b.id,bytesB]]),task=getDocument({data:new Uint8Array(bytesA),isEvalSupported:false});let ids,anchor;
 try{const page=await(await task.promise).getPage(1),ops=await page.getOperatorList();ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]).slice(0,3);const viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d');try{await page.render({canvas,canvasContext:ctx,viewport}).promise;const base=exampleImage(inkImage(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height),[...viewport.convertToViewportPoint(30,50),...viewport.convertToViewportPoint(50,30)]);anchor=viewport.convertToPdfPoint(base.left+base.width/2,base.top+base.height/2);}finally{canvas.width=canvas.height=0;}}finally{await task.destroy();}
 const events=[],canvases=[],run={cancelled:false};let next=0;
 const pdfjs={OPS,version,getDocument(options){const index=next++,drawingId=options.url?.split('/').at(-2);events.push({kind:'open',index,url:options.url});const task=getDocument({...options,...options.data?{}:{data:new Uint8Array(bytesById.get(drawingId)),url:undefined}});return {promise:task.promise.then(doc=>({numPages:doc.numPages,getOptionalContentConfig:o=>doc.getOptionalContentConfig(o),getPage:async number=>{events.push({kind:'page',index,number});const page=await doc.getPage(number),render=page.render.bind(page);page.render=options=>{events.push({kind:'render',index});assert.equal(options.operationsFilter,undefined,'original all-layer paint is never filtered');return render(options);};return page;}})),destroy:async()=>{await task.destroy();events.push({kind:'destroy',index});}};}};
 const example={drawing_id:a.id,digest:a.digest,page:1,bounds:[30,30,50,50],anchor:[9999,9999],elements:{renderer:ELEMENT_RENDERER,ids,excluded:[ids.at(-1)]}},targets=[{drawing:a,page:1},{drawing:a,page:2},{drawing:b,page:1}];
 return {a,b,bytesA,bytesB,anchor,events,canvases,run,args:{pdfjs,sourceDrawing:a,example,targets,layerPolicy:'same-layer-name',sourceData:bytesA,targetData:new Map([[b.id,bytesB]]),run,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}}};
}

test('saved page-set review prepares one source and fresh pages across two documents without changing IDs or native anchor',async()=>{
 const f=await fixture(),before=structuredClone({sourceDrawing:f.args.sourceDrawing,example:f.args.example,targets:f.args.targets}),report=await runSavedVectorPageSetReview(f.args);
 assert.equal(report.completed,true);assert.deepEqual(report.source,{drawingId:f.a.id,digest:f.a.digest,page:1,anchor:f.anchor});assert.notDeepEqual(f.anchor,[40,40]);
 assert.deepEqual(report.selection.ids,f.args.example.elements.ids);assert.deepEqual(report.selection.excluded,f.args.example.elements.excluded);assert.deepEqual(report.selection.anchor,f.anchor);
 assert.deepEqual(report.pages.map(p=>[p.drawingId,p.page,p.digest]),[[f.a.id,1,f.a.digest],[f.a.id,2,f.a.digest],[f.b.id,1,f.b.digest]]);
 assert.deepEqual(report.pages.map(p=>p.result.proposals.length),[2,2,2]);assert.ok(report.pages.every(p=>p.result.proposals.every(h=>h.visibility.verified)));
 assert.deepEqual(report.pages.map(p=>p.result.proposals.map(h=>h.x)),[[f.anchor[0],f.anchor[0]+60],[f.anchor[0]+30,f.anchor[0]+90],[f.anchor[0]+10,f.anchor[0]+70]]);
 assert.equal(report.totals.proposals,6);assert.equal(report.totals.verifiedElementIds,12);assert.ok(report.totals.auditWork>report.pages.reduce((sum,p)=>sum+p.result.auditWork,0),'source audit work charged too');
 assert.equal(f.events.filter(e=>e.kind==='open').length,5);assert.deepEqual(f.events.filter(e=>e.kind==='destroy').map(e=>e.index),[0,1,2,3,4]);
 for(let i=1;i<5;i++)assert.ok(f.events.findIndex(e=>e.kind==='destroy'&&e.index===i-1)<f.events.findIndex(e=>e.kind==='open'&&e.index===i));
 assert.ok(f.canvases.every(c=>c.width===0&&c.height===0));assert.equal(JSON.stringify(report).includes('"score"'),false);assert.equal(f.run.cancel,undefined);assert.equal(f.run.task,undefined);assert.deepEqual({sourceDrawing:f.args.sourceDrawing,example:f.args.example,targets:f.args.targets},before);
});

test('browser pages use digest-attested original routes; all injected document hashes are checked before opening',async()=>{
 const f=await fixture(),report=await runSavedVectorPageSetReview({...f.args,sourceData:undefined,targetData:undefined,layerPolicy:'all-admitted'});assert.equal(report.pages.length,3);assert.deepEqual(f.events.filter(e=>e.kind==='open').map(e=>e.url),Array(4).fill('/api/drawings/drawing-a/source').concat('/api/drawings/drawing-b/source'));
 const bad=await fixture(),corrupt=new Uint8Array(bad.bytesB);corrupt[0]^=1;await assert.rejects(runSavedVectorPageSetReview({...bad.args,targetData:new Map([[bad.b.id,corrupt]])}),/digest/);assert.equal(bad.events.length,0);
});

test('target scope validation refuses duplicates, missing source, conflicting identity and excessive page sets before PDF access',async()=>{
 const f=await fixture();for(const targets of [[f.args.targets[0],f.args.targets[0]],[f.args.targets[1]],[f.args.targets[0],{drawing:{...f.a,digest:'0'.repeat(64)},page:2}],Array.from({length:21},(_,i)=>({drawing:f.a,page:i+1}))])await assert.rejects(runSavedVectorPageSetReview({...f.args,targets}),/unique|include|conflict|20 explicit/);
 assert.equal(f.events.length,0);await assert.rejects(runSavedVectorPageSetReview({...f.args,layerPolicy:'automatic'}),/Invalid/);
});

test('input metadata and bytes are snapshotted before callbacks can mutate them',async()=>{
 const f=await fixture();let changed=false;const report=await runSavedVectorPageSetReview({...f.args,progress:()=>{if(!changed){changed=true;f.args.targets[1].page=199;f.args.example.elements.ids.length=0;f.bytesA.fill(0);f.bytesB.fill(0);}}});
 assert.deepEqual(report.pages.map(p=>p.page),[1,2,1]);assert.equal(report.selection.ids.length,3);assert.equal(report.totals.proposals,6);
});

test('cancellation after an earlier page and at final publication is atomic and releases every document and canvas',async()=>{
 for(const boundary of ['target-open','complete']){const f=await fixture();await assert.rejects(runSavedVectorPageSetReview({...f.args,progress:p=>{assert.equal(p.proposals,undefined);if(boundary==='complete'?p.stage==='complete':p.stage==='target-open'&&p.pageIndex===2)f.run.cancel();}}),/cancel/i);assert.equal(f.events.filter(e=>e.kind==='destroy').length,f.events.filter(e=>e.kind==='open').length);assert.ok(f.canvases.every(c=>c.width===0&&c.height===0));assert.equal(f.run.cancel,undefined);assert.equal(f.run.task,undefined);}
});

test('stalled PDF opening and source cleanup failure cannot publish or start target review',async()=>{
 const f=await fixture();let destroyed=0;await assert.rejects(runSavedVectorPageSetReview({...f.args,pdfjs:{OPS,version,getDocument:()=>({promise:new Promise(()=>{}),destroy:async()=>{destroyed++;}})},maxMilliseconds:30}),/timed out/);assert.equal(destroyed,1);assert.equal(f.run.task,undefined);
 const g=await fixture(),original=g.args.pdfjs.getDocument;await assert.rejects(runSavedVectorPageSetReview({...g.args,pdfjs:{...g.args.pdfjs,getDocument:options=>{const task=original(options);return {...task,destroy:async()=>{await task.destroy();throw Error('Owned cleanup failure');}};}}}),/cleanup failed/);assert.equal(g.events.filter(e=>e.kind==='open').length,1);assert.ok(g.canvases.every(c=>c.width===0&&c.height===0));
});

test('a later target render failure discards previously successful page results',async()=>{
 const f=await fixture(),original=f.args.pdfjs.getDocument;let opened=0;
 const pdfjs={...f.args.pdfjs,getDocument:options=>{const task=original(options),index=opened++;if(index!==4)return task;return {...task,promise:task.promise.then(doc=>({...doc,getPage:async number=>{const page=await doc.getPage(number);page.render=()=>{throw Error('Owned last-target render failure');};return page;}}))};}};
 await assert.rejects(runSavedVectorPageSetReview({...f.args,pdfjs}),/render.*failed|last-target render failure/i);
 assert.equal(opened,5);assert.equal(f.events.filter(e=>e.kind==='destroy').length,5);assert.ok(f.canvases.every(c=>c.width===0&&c.height===0));assert.equal(f.run.cancel,undefined);assert.equal(f.run.task,undefined);
});

test('aggregate proposal limit refuses six individually bounded original pages atomically',async()=>{
 const content='0 g '+Array.from({length:350},(_,i)=>`${10+i%35*5} ${10+Math.floor(i/35)*5} 3 3 re f`).join('\n'),bytes=pdf(Array(6).fill(content)),digest=createHash('sha256').update(bytes).digest('hex'),drawing={id:'owned-budget',digest},task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});let id;
 try{const ops=await(await(await task.promise).getPage(1)).getOperatorList();id=ops.fnArray.findIndex(op=>op===OPS.constructPath);}finally{await task.destroy();}
 let opened=0,destroyed=0;const canvases=[],run={cancelled:false},pdfjs={OPS,version,getDocument:options=>{opened++;const task=getDocument(options);return {promise:task.promise,destroy:async()=>{await task.destroy();destroyed++;}};}};
 await assert.rejects(runSavedVectorPageSetReview({pdfjs,sourceDrawing:drawing,example:{drawing_id:drawing.id,digest,page:1,bounds:[9,9,14,14],elements:{renderer:ELEMENT_RENDERER,ids:[id],excluded:[]}},targets:Array.from({length:6},(_,i)=>({drawing,page:i+1})),layerPolicy:'all-admitted',sourceData:bytes,run,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}}),/Page-set proposal or verified-element budget exceeded/);
 assert.equal(opened,8);assert.equal(destroyed,8);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.equal(run.task,undefined);
});

test('cross-page original hairline compounds retain quarter-turns and collapsed triangles while rejecting colour, width and winding changes',async()=>{
 const glyph=(x,{rotation=false,collapsed=false,red=false,width=0,reversed=false}={})=>`/OC /Symbols BDC q ${rotation?'0 1 -1 0':'1 0 0 1'} ${x} 40 cm 0 G 0 g ${width} w -4 -4 8 8 re S 0 w ${red?'1 0 0 rg':''} ${reversed?'0 1 m 1 -1 l -1 -1 l':'-1 -1 m 1 -1 l 0 1 l'} h -.3 0 m .3 0 l 0 ${collapsed?0:.06} l h B Q EMC`;
 const bytesA=pdf([glyph(40)+' /OC /Symbols BDC 0 G 1 w 40 45 m 40 70 l S EMC',glyph(40,{rotation:true})+' '+glyph(80,{collapsed:true})+' '+glyph(120,{red:true})+' '+glyph(160,{width:.2})+' '+glyph(200,{reversed:true})]),bytesB=pdf([glyph(100,{rotation:true,collapsed:true})]),digest=b=>createHash('sha256').update(b).digest('hex'),source={id:'compound-source',digest:digest(bytesA)},target={id:'compound-target',digest:digest(bytesB)};
 const extraction=getDocument({data:new Uint8Array(bytesA),isEvalSupported:false});let ids;
 try{const ops=await(await(await extraction.promise).getPage(1)).getOperatorList();ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]);}finally{await extraction.destroy();}
 assert.equal(ids.length,3);const canvases=[],events=[],pdfjs={OPS,version,getDocument(options){const task=getDocument(options);events.push('open');return{promise:task.promise,destroy:async()=>{await task.destroy();events.push('destroy');}};}};
 const result=await runSavedVectorPageSetReview({pdfjs,sourceDrawing:source,example:{drawing_id:source.id,digest:source.digest,page:1,bounds:[30,30,50,50],elements:{renderer:ELEMENT_RENDERER,ids,excluded:[ids[2]]}},targets:[{drawing:source,page:1},{drawing:source,page:2},{drawing:target,page:1}],layerPolicy:'same-layer-name',sourceData:bytesA,targetData:new Map([[target.id,bytesB]]),createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}});
 assert.deepEqual(result.pages.map(p=>p.result.proposals.length),[1,2,1]);assert.ok(result.pages.every(p=>p.result.proposals.every(h=>h.visibility.verified&&h.elementIds.length===2)));
 assert.deepEqual(result.selection.excluded,[ids[2]]);assert.deepEqual(result.pages[1].result.proposals.map(h=>h.rotation).sort((a,b)=>a-b),[0,90]);assert.equal(result.pages[2].result.proposals[0].rotation,90);
 assert.ok(result.pages.every(p=>p.result.coverage.complete===false&&p.result.allHandlesPreparedBeforeRendering===true));assert.equal(result.totals.proposals,4);assert.equal(result.totals.verifiedElementIds,8);
 assert.equal(events.filter(e=>e==='open').length,5);assert.equal(events.filter(e=>e==='destroy').length,5);assert.ok(canvases.every(c=>c.width===0&&c.height===0));
});
