import test from 'node:test';
import assert from 'node:assert/strict';
import {createContourTemplate,findContourCandidates} from '../apps/local/web/vector-contours.mjs';
const style={fill:null,stroke:'#000000',width:.4,cap:1,join:1,miter:10,rule:'nonzero'};
function element(id,points,paint=style){const segments=points.slice(1).map((p,i)=>[1,...points[i],...p]);return{id,segments,bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],style:{...paint}};}
const outline=[[0,0],[8,0],[8,8],[0,8],[0,0]],detail=[[3,3],[4,3],[3,4],[3,3]];
const shifted=(ps,x,y=0)=>ps.map(p=>[p[0]+x,p[1]+y]);
const glyph=(id,x=0)=>[element(id,shifted(outline,x)),element(id+1,shifted(detail,x),{...style,fill:'#ff0000',stroke:null,width:0})];
const page=elements=>({supported:true,elements});
const selection={bounds:[-1,-1,9,9],anchor:[4.2,3.7],ids:[1,2]};
test('closed contour subdivision retains anchor, all operations, and complete provenance',()=>{
 const fine=outline.flatMap((p,i)=>i===outline.length-1?[p]:[p,[(p[0]+outline[i+1][0])/2,(p[1]+outline[i+1][1])/2]]),g=page([...glyph(1),element(3,shifted(fine,20)),glyph(3,20)[1]]),before=structuredClone(g),t=createContourTemplate(g,selection),hits=findContourCandidates(g,t,{rotations:false});
 assert.deepEqual(hits.map(h=>h.x),[4.2,24.2]);assert.deepEqual(g,before);assert.ok(hits.every(h=>h.requiresRenderVerification&&!('score'in h)&&h.wholeOperations));assert.deepEqual(hits[1].provenance[0].segmentIndices,[0,1,2,3,4,5,6,7]);
});
test('background stroke bounding boxes do not hide source; actual intersecting strokes and fills do',()=>{
 const background=element(10,[[-50,-50],[-50,50],[50,50],[50,-50]]),g=page([...glyph(1),background]),t=createContourTemplate(g,selection);assert.equal(findContourCandidates(g,t).length,1);
 for(const extra of [element(11,[[2,2],[6,6]]),element(12,[[-20,-20],[20,20]]),element(13,[[-20,-20],[20,-20],[20,20],[-20,20],[-20,-20]],{...style,fill:'#ffffff',stroke:null,width:0})])assert.equal(findContourCandidates(page([...g.elements,extra]),t).length,0);
});
test('exclusions are exact complete geometry; no blanket ignored paint style',()=>{
 const pipe=element(9,[[4,-5],[4,12]],{...style,stroke:'#ff0000'}),g=page([...glyph(1),pipe]),t=createContourTemplate(g,{...selection,ids:[1,2,9],excluded:[9]});assert.equal(t.supported,true);assert.equal(findContourCandidates(g,t).length,1);
 assert.deepEqual(findContourCandidates(g,t)[0].contextExclusions,[{elementId:9,sourceExcludedElementId:9,segmentIndices:[0]}]);
 assert.deepEqual(findContourCandidates(g,t,{excludedContext:'straight-exterior'})[0].contextExclusions,[{elementId:9,sourceExcludedElementId:9,segmentIndices:[0]}]);
 const changed=structuredClone(g);changed.elements.at(-1).segments[0][1]+=.1;assert.equal(findContourCandidates(changed,t).length,0);
});
test('curve/open sources, malformed data, budgets, cancellation and unsupported pages fail closed',()=>{
 const g=page(glyph(1)),t=createContourTemplate(g,selection);assert.equal(createContourTemplate(page([element(1,[[0,0],[8,0],[8,8]])]),{...selection,ids:[1]}).supported,false);
 for(const options of [{tolerance:.26},{relativeCentreTolerance:.13},{maxComparisons:0},{rotations:1},{cancelled:null}])assert.throws(()=>findContourCandidates(g,t,options));
 assert.throws(()=>findContourCandidates(g,t,{maxComparisons:1}),{code:'VECTOR_CONTOURS_BUDGET'});assert.throws(()=>findContourCandidates(g,t,{cancelled:()=>true}),{code:'VECTOR_CONTOURS_CANCELLED'});assert.throws(()=>findContourCandidates({...g,supported:false},t));
 const invalid=structuredClone(g);invalid.elements[0].segments[0][1]=NaN;assert.throws(()=>findContourCandidates(invalid,t));assert.throws(()=>findContourCandidates({...g,textRegions:[[0,0,NaN,4]]},t));
 const invisible=page([...glyph(1),element(4,[[6,6],[6,6]])]);assert.equal(findContourCandidates(invisible,t).length,0,'zero-length painted dots cannot silently disappear');
});
test('declared grid keeps a shared transform and rejects class changes beyond rounding uncertainty',()=>{
 const q=.24,snap=(points,x,y=0)=>points.map(p=>[Math.round((p[0]+x)/q)*q,Math.round((p[1]+y)/q)*q]);
 const make=(id,x,y=0,shift=0)=>[element(id,snap(outline,x,y)),element(id+1,snap(shifted(detail,shift),x,y),{...style,fill:'#ff0000',stroke:null,width:0})];
 const elements=[...make(1,0),...make(3,24.04,.08),...make(5,48.12,.16),...make(7,72.2,.2),...make(9,96.04,.08,.72)],g=page(elements),t=createContourTemplate(g,selection),before=structuredClone(g),hits=findContourCandidates(g,t,{knownGrid:q,rotations:false});
 assert.equal(hits.length,4);assert.deepEqual(hits.map(h=>h.elementIds),[[1,2],[3,4],[5,6],[7,8]]);assert.ok(hits.every(h=>h.geometryPolicy==='declared-cad-grid'&&h.gridSpacing===q&&h.coordinateErrorBound>=q&&!('score'in h)));assert.deepEqual(g,before);
 assert.throws(()=>findContourCandidates(g,t,{knownGrid:-1}));assert.throws(()=>findContourCandidates(page(glyph(1)),createContourTemplate(page(glyph(1)),selection),{knownGrid:q}),/declared CAD grid/);
});
test('explicit exterior context permission ignores only complete straight same-style strokes',()=>{
 const pipeStyle={...style,stroke:'#ff0000',width:.2},pipe=element(9,[[4,-5],[4,12]],pipeStyle),g=page([...glyph(1),pipe]),t=createContourTemplate(g,{...selection,ids:[1,2,9],excluded:[9]});
 const target=page([...glyph(3,20),element(10,[[16,4],[24,4],[35,4]],pipeStyle)]);assert.equal(findContourCandidates(target,t).length,0);
 const hits=findContourCandidates(target,t,{excludedContext:'straight-exterior'});assert.equal(hits.length,1);assert.deepEqual(hits[0].contextExclusions,[{elementId:10,sourceExcludedElementId:9,segmentIndices:[0,1]}]);
 for(const points of [[[22,4],[26,4]],[[16,4],[24,4],[24,12]],[[16,4],[35,4],[24,4]],[[22,2],[26,2],[26,6],[22,2]]])assert.equal(findContourCandidates(page([...glyph(3,20),element(10,points,pipeStyle)]),t,{excludedContext:'straight-exterior'}).length,0);
 const noPermission=createContourTemplate(page(glyph(1)),selection);assert.equal(findContourCandidates(target,noPermission,{excludedContext:'straight-exterior'}).length,0);assert.throws(()=>findContourCandidates(g,t,{excludedContext:'all'}));
});
test('self-intersecting fill boundaries do not establish winding equivalence',()=>{
 // Same traced edges, but reversing the inserted overlapping loop cancels
 // the nonzero fill in the overlap. There is only one return to path start.
 const prefix=[[0,0],[4,0],[4,2],[6,1]],loop=[[6,1],[6,3],[2,3],[2,1],[6,1]],suffix=[[4,2],[4,4],[0,4],[0,0]],a=[...prefix,...loop.slice(1),...suffix],b=[...prefix,...[...loop].reverse().slice(1),...suffix],fill={...style,fill:'#000000',stroke:null,width:0};
 const winding=poly=>{const p=[3,2];let n=0;for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i],cross=(b[0]-a[0])*(p[1]-a[1])-(p[0]-a[0])*(b[1]-a[1]);if(a[1]<=p[1]&&b[1]>p[1]&&cross>0)n++;if(a[1]>p[1]&&b[1]<=p[1]&&cross<0)n--;}return n;};assert.equal(winding(a),2);assert.equal(winding(b),0);
 for(const ps of [a,b,[[0,0],[4,4],[0,4],[4,0],[0,0]],[[0,0],[4,0],[2,0],[4,4],[0,0]]]){const g=page([element(1,ps,fill)]),t=createContourTemplate(g,{bounds:[-1,-1,7,5],anchor:[3,2],ids:[1]});assert.equal(t.supported,false);assert.match(t.reason,/simple fills/);}
});
