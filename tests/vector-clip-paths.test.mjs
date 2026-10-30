import test from 'node:test';
import assert from 'node:assert/strict';
import {OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractClipFillProposals} from '../apps/local/web/vector-clip-paths.mjs';
const triangle=[0,0,0,1,10,0,1,0,10,4];
const rect=(x0,y0,x1,y1)=>[0,x0,y0,1,x1,y0,1,x1,y1,1,x0,y1,4];
function program(){const fnArray=[],argsArray=[];return {fnArray,argsArray,add(op,args=null){fnArray.push(op);argsArray.push(args);return fnArray.length-1;},path(paint,path){return this.add(OPS.constructPath,[paint,[new Float32Array(path)],[0,0,10,10]]);}};}
function source(){const p=program();p.add(OPS.save);p.add(OPS.transform,[2,0,0,2,5,7]);const clipOperatorId=p.add(OPS.eoClip),clipPathId=p.path(OPS.endPath,triangle);p.add(OPS.setFillRGBColor,['#336699']);const paintId=p.path(OPS.fill,rect(-1,-1,11,11));p.add(OPS.restore);return {p,clipOperatorId,clipPathId,paintId};}
const run=p=>extractClipFillProposals({operatorList:p,OPS});

test('clipped-fill proposal retains original IDs, source commands and transforms without claiming final visibility',()=>{
 const {p,clipOperatorId,clipPathId,paintId}=source(),before=Array.from(p.argsArray[clipPathId][1][0]),r=run(p);
 assert.equal(r.proposals.length,1);const proposal=r.proposals[0];
 assert.deepEqual([proposal.clipOperatorId,proposal.clipPathId,proposal.paintId],[clipOperatorId,clipPathId,paintId]);
 assert.deepEqual(proposal.bounds,[5,7,25,27]);assert.deepEqual(proposal.anchor,[15,17]);
 assert.deepEqual(proposal.clip.sourceCommands,triangle);assert.deepEqual(proposal.clip.matrix,[2,0,0,2,5,7]);
 assert.equal(proposal.visibility,'unverified');assert.equal(proposal.requiresRenderVerification,true);assert.equal(r.complete,false);
 proposal.clip.sourceCommands[1]=999;assert.deepEqual(Array.from(p.argsArray[clipPathId][1][0]),before);
});

test('nested clipping rejects nested fills and restores the prior clip exactly with Q',()=>{
 const p=program();p.add(OPS.save);p.add(OPS.clip);const outer=p.path(OPS.endPath,triangle),first=p.path(OPS.fill,rect(-1,-1,11,11));
 p.add(OPS.save);p.add(OPS.clip);p.path(OPS.endPath,rect(0,0,2,2));const nested=p.path(OPS.fill,rect(-1,-1,11,11));p.add(OPS.restore);
 const restored=p.path(OPS.fill,rect(-1,-1,11,11));p.add(OPS.restore);const unclipped=p.path(OPS.fill,rect(-1,-1,11,11));
 const r=run(p);assert.deepEqual(r.proposals.map(x=>x.paintId),[first,restored]);assert.ok(r.proposals.every(x=>x.clipPathId===outer));
 assert.equal(r.paintContexts.find(x=>x.paintId===nested).supportedClipChain,false);assert.deepEqual(r.paintContexts.find(x=>x.paintId===unclipped).clipPathIds,[]);
});

test('pending clipping is installed after the defining path paints, and that paint is marked structural',()=>{
 const p=program();p.add(OPS.save);p.add(OPS.clip);const stroke=p.path(OPS.stroke,triangle),fill=p.path(OPS.fill,rect(-1,-1,11,11));p.add(OPS.restore);
 const r=run(p);assert.deepEqual(r.proposals.map(x=>x.paintId),[fill]);assert.equal(r.proposals[0].clipPathId,stroke);
 assert.deepEqual(r.paintContexts.find(x=>x.paintId===stroke),{paintId:stroke,clipPathIds:[],supportedClipChain:true,opaque:true,definesClip:true});
});

test('partial covers, opacity, complex clips and later white overpainting never imply visible complete geometry',()=>{
 for(const alteration of ['partial','opacity','hole','self-crossing','curve']){const {p,paintId,clipPathId}=source();if(alteration==='partial')p.argsArray[paintId][1][0]=new Float32Array(rect(-1,-1,5,11));
 if(alteration==='opacity'){p.fnArray.splice(paintId,0,OPS.setGState);p.argsArray.splice(paintId,0,[[['ca',.5]]]);}
 if(alteration==='hole')p.argsArray[clipPathId][1][0]=new Float32Array([...rect(0,0,10,10),...rect(2,2,8,8)]);
 if(alteration==='self-crossing')p.argsArray[clipPathId][1][0]=new Float32Array([0,0,0,1,10,10,1,0,10,1,10,0,4]);
 if(alteration==='curve')p.argsArray[clipPathId][1][0]=new Float32Array([0,0,0,2,0,10,10,10,10,0,4]);
 assert.equal(run(p).proposals.length,0,alteration);}
 const {p}=source();p.add(OPS.setFillRGBColor,['#ffffff']);p.path(OPS.fill,rect(0,0,100,100));const r=run(p);assert.equal(r.proposals.length,1);assert.equal(r.proposals[0].visibility,'unverified');
});

test('clip proposal failures are bounded and return no partial candidates',()=>{
 const {p}=source();assert.equal(extractClipFillProposals({operatorList:p,OPS,cancelled:()=>true}).proposals.length,0);
 const q=program();q.add(OPS.save);q.add(OPS.clip);q.path(OPS.endPath,triangle);q.path(OPS.fill,rect(-1,-1,11,11));q.path(OPS.fill,rect(-1,-1,11,11));q.add(OPS.restore);
 const limited=extractClipFillProposals({operatorList:q,OPS,maxProposals:1});assert.equal(limited.proposals.length,0);assert.match(limited.reason,/budget/);
 const malformed=program();malformed.add(OPS.restore);assert.match(run(malformed).reason,/Unbalanced/);
});


test('active clip chains and retained paint-context IDs have independent atomic storage limits',()=>{
 const deep=program();for(let i=0;i<65;i++){deep.add(OPS.clip);deep.path(OPS.endPath,triangle);}
 const depthResult=run(deep);assert.deepEqual(depthResult.proposals,[]);assert.match(depthResult.reason,/depth budget/);
 const contexts=program();for(let i=0;i<64;i++){contexts.add(OPS.clip);contexts.path(OPS.endPath,triangle);}for(let i=0;i<4000;i++)contexts.path(OPS.fill,rect(-1,-1,11,11));
 const contextResult=run(contexts);assert.deepEqual(contextResult.proposals,[]);assert.deepEqual(contextResult.paintContexts,[]);assert.match(contextResult.reason,/context storage budget/);
});
