import {createHash} from 'node:crypto';

// Original independently specified controls. Labels express intended visible
// symbol semantics, never whichever instances the candidate happens to return.
const positives=[
 {id:'source'}, {id:'collinear-subdivision',subdivide:3},
 {id:'circle-64-segments',segments:64}, {id:'circle-96-segments',segments:96},
 {id:'reversed-walk',reverse:true}, {id:'changed-start',start:9},
 {id:'overlapping-closed-walks',duplicateLoop:true},
 {id:'split-ring-paints',split:true}, {id:'quarter-turn',rotation:90},
 {id:'outer-CAD-jitter',jitter:.06}, {id:'quantized-circle',quantize:.24},
 {id:'separate-crossing-pipe',pipe:true},
].map((p,i)=>({...p,page:1,x:40+(i%6)*70,y:50+Math.floor(i/6)*70,positive:true}));
const negatives=[
 {id:'shifted-centre',kind:'shift'}, {id:'missing-centre',kind:'missing'},
 {id:'extra-quarter',kind:'quarter'}, {id:'extra-ring',kind:'ring'},
 {id:'extra-spoke',kind:'spoke'}, {id:'wrong-fill',kind:'fill'},
 {id:'wrong-stroke-width',kind:'width'}, {id:'stroked-centre',kind:'outline'},
 {id:'white-overpaint-centre',kind:'overpaint'}, {id:'mirrored-centre',kind:'mirror'},
].map((p,i)=>({...p,page:p.kind==='overpaint'?3:1,x:40+(i%6)*70,y:220+Math.floor(i/6)*70,positive:false}));
const n=v=>String(+v.toFixed(6));
const line=p=>p.map(n).join(' ');
function path(points,close=true){return points.map((p,i)=>line(p)+(i?' l':' m')).join(' ')+(close?' h':'');}
function splitEdges(points){return points.map((p,i)=>path([p,points[(i+1)%points.length]],false)+' S').join(' ');}
function subdivide(points,count){return points.flatMap((p,i)=>Array.from({length:count},(_,j)=>p.map((v,k)=>v+(points[(i+1)%points.length][k]-v)*j/count)));}
function glyph(s){
 let ring=Array.from({length:s.segments||32},(_,i)=>{const a=i*2*Math.PI/(s.segments||32);return [6*Math.cos(a),6*Math.sin(a)].map((v,k)=>s.quantize?Math.round(v/s.quantize)*s.quantize:v+(s.jitter&&k===0?s.jitter:0));});
 if(s.subdivide)ring=subdivide(ring,s.subdivide);
 if(s.reverse)ring.reverse();if(s.start)ring=[...ring.slice(s.start),...ring.slice(0,s.start)];
 let centre=[[-1.8,.3],[-.6,.3],[-1.2,1.5]];
 if(s.kind==='shift')centre=centre.map(([x,y])=>[x+.3,y]);
 if(s.kind==='mirror')centre=centre.map(([x,y])=>[-x,y]);
 if(s.subdivide)centre=subdivide(centre,s.subdivide);
 const matrix=s.rotation===90?'0 1 -1 0':'1 0 0 1';
 let ink=s.split?splitEdges(ring):path(ring)+' S';
 if(s.duplicateLoop)ink+=' '+path([...ring.slice(8),...ring.slice(0,8)])+' S';
 if(s.kind!=='missing')ink+=` ${s.kind==='fill'?'1 0 0 rg ':''}${path(centre)} ${s.kind==='outline'?'S':'f'} 0 g`;
 if(s.kind==='quarter')ink+=' 2 2 m 4 2 l 2 4 l h f';
 if(s.kind==='ring')ink+=' -3 -3 6 6 re S';
 if(s.kind==='spoke')ink+=' 2 0 m 5 0 l S';
 if(s.kind==='overpaint')ink+=' 1 g -2 0 2 2 re f';
 if(s.pipe)ink+=' .2 w -12 0 m 12 0 l S';
 return `q ${matrix} ${s.x} ${s.y} cm 0 g 0 G ${s.kind==='width'?.8:.4} w 0 J 0 j ${ink} Q`;
}
function literalPdf(contents){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${contents.map((_,i)=>`${3+i*2} 0 R`).join(' ')}] /Count ${contents.length} >>`];
 for(const [i,c]of contents.entries())objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 440 340] /Resources << >> /Contents ${4+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`);
 let out='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(v=>`${String(v).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out);
}
export function contourQaFixture(){
 const clipped={id:'clipped-visible-positive',page:2,x:40,y:50,positive:true};
 const bytes=literalPdf([[...positives,...negatives.filter(p=>p.page===1)].map(glyph).join('\n'),`q 25 35 30 30 re W n ${glyph(clipped)} Q`,negatives.filter(p=>p.page===3).map(glyph).join('\n')]);
 return {bytes,manifest:{id:'independent-contours-v2',sha256:createHash('sha256').update(bytes).digest('hex'),provenance:'Original independently generated literal PDF; no customer or competitor content',sourcePage:1,selection:[32,42,48,58],anchor:[40,50],labels:[...positives,clipped],negatives,proposalTolerance:.25,relativeCentreTolerance:.125,anchorScoringTolerance:.25,policy:'Radius6 circle is one intended shape despite polygon tessellation or 0.24 CAD-grid coordinates. Centre triangle remains identical and a 0.3 translation is a negative. Geometry proposals are not accepted detections. Split butt-capped ring paints change tiny corner coverage and require rendering review; duplicated opaque loop changes antialiasing. Clipped visible positive remains in recall even when unsupported. White-overpaint negative has its own page because current extraction rejects the entire page on white paint.',limitations:['Synthetic only; no real-world or competitor accuracy claim','Rendering differences, overpaint and clipping need independent verification','Scale variation and arbitrary rotation are outside this kernel contract']}};
}

// Separately declared CAD-noise family. The entire continuous glyph, including
// its centre detail, is transformed before rounding every vertex to one global
// CAD grid. No component receives an independently fitted correction.
export function quantizedContourQaFixture(){
 const grid=.24,phases=[[0,0],[.04,.08],[.08,.16],[.12,.04],[.16,.12],[.20,.20]],labels=phases.map(([dx,dy],i)=>({id:'global-grid-phase-'+i,page:1,x:40+i*60+dx,y:50+dy,rotation:0}));
 labels.push({id:'global-grid-quarter-turn',page:1,x:40.08,y:120.16,rotation:90});
 const negatives=[{id:'missing-centre',kind:'missing'},{id:'centre-displaced-.72',kind:'shift',shift:.72},{id:'extra-quarter',kind:'quarter'},{id:'extra-ring',kind:'ring'},{id:'extra-spoke',kind:'spoke'},{id:'sidewall',kind:'sidewall'}].map((p,i)=>({...p,page:1,x:40+i*60+.08,y:220.16,rotation:0}));
 const sensitivity=[{id:'centre-shift-.12-ambiguous',kind:'shift',shift:.12,page:1,x:120.08,y:120.16,rotation:0,classification:'Ambiguous sensitivity only; excluded from accuracy counts'}];
 function draw(s){
  const map=([x,y])=>{if(s.rotation===90)[x,y]=[-y,x];return [Math.round((x+s.x)/grid)*grid,Math.round((y+s.y)/grid)*grid];};
  const ring=Array.from({length:64},(_,i)=>[6*Math.cos(i*Math.PI/32),6*Math.sin(i*Math.PI/32)]),detail=[[-1.8,.3],[-.6,.3],[-1.2,1.5]].map(([x,y])=>[x+(s.shift||0),y]);
  let ink=path(ring.map(map))+' S';if(s.kind!=='missing')ink+=' '+path(detail.map(map))+' f';
  const extra=s.kind==='quarter'?[[2,2],[4,2],[2,4]]:s.kind==='ring'?[[-3,-3],[3,-3],[3,3],[-3,3]]:s.kind==='spoke'?[[2,0],[5,0]]:s.kind==='sidewall'?[[-6,-6],[6,-6]]:[];
  if(extra.length)ink+=' '+path(extra.map(map),extra.length>2)+(s.kind==='quarter'?' f':' S');
  return 'q 0 g 0 G .4 w 0 J 0 j '+ink+' Q';
 }
 const bytes=literalPdf([[...labels,...negatives,...sensitivity].map(draw).join('\n')]);
 return {bytes,manifest:{id:'independent-global-CAD-phase-v1',sha256:createHash('sha256').update(bytes).digest('hex'),provenance:'Original continuous symbol independently transformed then quantized; no real or competitor assets',sourcePage:1,selection:[32,42,48,58],anchor:[40,50],grid,coordinateRoundingBoundPerAxis:.12,pairwiseRoundingBoundPerAxis:.24,labels,negatives,sensitivity,anchorScoringTolerance:.35,policy:'All positives derive from precisely the same continuous radius6 circle and centre triangle under a single whole-symbol translation/quarter-turn before global .24-grid rounding. Source+target coordinate errors can differ by .24 per axis. Intentional .72 centre shift exceeds that pairwise bound. .12 shift is sensitivity only and cannot establish a class distinction. Global transform must fit every component together.',limitations:['Synthetic CAD quantization model; real exporter noise and estimator classification unverified','No local component shift, accepted detections, scale claim or real-world accuracy inferred']}};
}

// Explicit erased-context policy controls, declared before policy evaluation.
// Unsafe-context cases still contain the true glyph; they are POLICY negatives,
// not mislabeled wrong symbols. Their unresolved recall stays visible.
export function contourPipeContextQaFixture(){
 const labels=[{id:'source-horizontal',pipe:[[-16,0],[16,0]]},{id:'vertical-context',pipe:[[0,-16],[0,16]]},{id:'diagonal-context',pipe:[[-13,-13],[13,13]]},{id:'steep-context',pipe:[[-8,-20],[8,20]]},{id:'short-exit-context',pipe:[[1,0],[9,0]]},{id:'long-context',pipe:[[-28,0],[28,0]]},{id:'reversed-context',pipe:[[16,0],[-16,0]]},{id:'segmented-collinear-context',pipe:[[-16,0],[0,0],[16,0]]}].map((p,i)=>({...p,page:1,x:45+(i%5)*75,y:45+Math.floor(i/5)*75}));
 const semanticNegatives=[{id:'missing-centre',kind:'missing'},{id:'interior-spoke',kind:'spoke'},{id:'extra-closed-loop',kind:'loop'}].map((p,i)=>({...p,page:1,x:45+i*75,y:220,pipe:[[-16,0],[16,0]]}));
 const policyNegatives=[{id:'whole-pipe-operation-unrelated-tail',kind:'tail'},{id:'bent-exiting-context',kind:'elbow'},{id:'different-width-context',kind:'width'},{id:'interior-only-context',kind:'interior'}].map((p,i)=>({...p,page:1,x:45+i*75,y:295,pipe:[[-16,0],[16,0]],containsTrueGlyph:true,classification:'Policy refusal control; do not claim this is a wrong symbol'}));
 const ring=Array.from({length:32},(_,i)=>[6*Math.cos(i*Math.PI/16),6*Math.sin(i*Math.PI/16)]),triangle=[[-1.8,.3],[-.6,.3],[-1.2,1.5]];
 const draw=s=>{let ink=path(ring)+' S';if(s.kind!=='missing')ink+=' '+path(triangle)+' f';let pipe=s.kind==='elbow'?[[-16,0],[0,0],[0,16]]:s.kind==='interior'?[[0,0],[3,0]]:s.pipe;ink+=` .8 0 0 RG ${s.kind==='width'?.4:.2} w `+path(pipe,false)+(s.kind==='tail'?' 20 0 m 20 10 l':'')+' S';if(s.kind==='spoke')ink+=' 0 1 m 0 4 l S';if(s.kind==='loop')ink+=' -3 -3 6 6 re S';return `q 1 0 0 1 ${s.x} ${s.y} cm 0 G 0 g .4 w 0 J 0 j ${ink} Q`;};
 const bytes=literalPdf([[...labels,...semanticNegatives,...policyNegatives].map(draw).join('\n')]);
 return {bytes,manifest:{id:'independent-explicit-pipe-context-v1',sha256:createHash('sha256').update(bytes).digest('hex'),provenance:'Original literal PDF, independently labelled before exclusion policy evaluation',selection:[37,37,53,53],anchor:[45,45],sourceExcludedBounds:[29,45,61,45],labels,semanticNegatives,policyNegatives,policy:'An explicitly erased entire red straight source pipe may authorize same-style same-width whole target straight open strokes exiting the glyph envelope. Rotation, direction and length may vary. Interior-only strokes, bent strokes, wrong widths, closed loops and a whole operation with unrelated extra tail are not covered by that permission. No partial operation can be ignored. Missing centre remains a wrong symbol.',limitations:['Synthetic opt-in permission-policy test only','Policy-refused contexts retain true glyphs and must remain reported as unresolved glyph coverage','No default policy change or real recognition approval implied']}};
}

export function contourWindingQaFixture(){
 // Both paths have exactly the same undirected segments. Reversing only the
 // inserted right loop changes nonzero winding in the overlapping interior.
 // The connecting spur is traversed in both directions and paints no area.
 const prefix=[[-4.5,-3],[1.5,-3],[1.5,0],[-1.5,-3]],suffix=[[-1.5,-3],[1.5,0],[1.5,3],[-4.5,3]],same=[[4.5,-3],[4.5,3],[-1.5,3]],opposite=[[-1.5,3],[4.5,3],[4.5,-3]],source={x:40,y:50},negative={x:120,y:50};
 const draw=(p,loop)=>`q 1 0 0 1 ${p.x} ${p.y} cm 0 g ${path([...prefix,...loop,...suffix])} f Q`,bytes=literalPdf([draw(source,same)+'\n'+draw(negative,opposite)]);
 return {bytes,manifest:{id:'independent-overlapping-winding-v1',sha256:createHash('sha256').update(bytes).digest('hex'),provenance:'Original literal nonzero-fill winding counterexample; no external assets',selection:[32,42,48,58],anchor:[40,50],source,negative,policy:'Equal boundary segments do not establish equal filled interior. Left+right same winding fills the overlap; opposite winding cancels it. Both source selections must fail closed until fill topology is independently supported.',limitations:['Deliberately nonsimple fill safety control, not a representative construction benchmark']}};
}

export function rectangleClipQaFixture(){
 const lineClosed='10 10 m 90 10 l 90 90 l 10 90 l 10 10 l W n',implicit='10 10 m 90 10 l 90 90 l 10 90 l W n',symbol='0 G 1 w 40 40 m 60 40 l 60 60 l 40 60 l h S';
 const cases=[
  {id:'line-return-rectangle',content:`q ${lineClosed} ${symbol} Q`,admit:true,physicallyRedundant:true},
  {id:'explicit-close-rectangle',content:`q 10 10 80 80 re W n ${symbol} Q`,admit:true,physicallyRedundant:true},
  {id:'nested-rectangles',content:`q 0 0 100 100 re W n q 20 20 60 60 re W n ${symbol} Q Q`,admit:true,physicallyRedundant:true},
  {id:'quarter-turn-rectangle',content:`q 0 1 -1 0 100 0 cm ${lineClosed} ${symbol} Q`,admit:true,physicallyRedundant:true},
  {id:'nonuniform-clip-CTM-native-rectangle',content:`q 2 0 0 1 0 0 cm 5 10 40 80 re W n .5 0 0 1 0 0 cm ${symbol} Q`,admit:true,physicallyRedundant:true},
  {id:'round-cap-crosses-clip',content:'q 40 40 20 20 re W n 0 G 2 w 1 J 40 50 m 60 50 l S Q',admit:false,physicallyRedundant:false},
  {id:'whole-operation-remote-tail',content:'q 10 10 80 80 re W n 0 G 1 w 40 40 m 60 40 l 95 95 m 110 95 l S Q',admit:false,physicallyRedundant:false},
  {id:'miter-crosses-clip',content:'q 10 10 80 80 re W n 0 G 4 w 0 j 10 M 11 20 m 11 11 l 20 11 l S Q',admit:false,physicallyRedundant:false},
  {id:'rotated-nonrectangular-native-clip',content:`q 1 1 -1 1 50 50 cm -30 -30 60 60 re W n .5 -.5 .5 .5 -50 0 cm ${symbol} Q`,admit:false,physicallyRedundant:true,refusalPolicy:'Non-axis-aligned native clip intentionally unsupported'},
  {id:'implicit-close-rectangle',content:`q ${implicit} ${symbol} Q`,admit:false,physicallyRedundant:true,refusalPolicy:'Implicit PDF clip closure intentionally unsupported by first policy'},
  {id:'hairline-device-pixel-guard',content:'q 10 10 80 80 re W n 0 G .02 w 1 M 1 J 1 j 11.5 40 m 11.5 60 l S Q',admit:true,physicallyRedundant:true,scaleQuarterAdmit:false},
 ].map((p,i)=>({...p,page:i+1}));
 const bytes=literalPdf(cases.map(p=>p.content)),unclippedBytes=literalPdf(cases.map(p=>p.content.replaceAll('W n','n')));
 return {bytes,unclippedBytes,manifest:{id:'independent-redundant-rectangle-clips-v1',sha256:createHash('sha256').update(bytes).digest('hex'),unclippedSha256:createHash('sha256').update(unclippedBytes).digest('hex'),provenance:'Original literal PDFs; unclipped paired oracle independently generated from same blueprint, no customer content',cases,defaultViewportScale:2,policy:'Whole-operation geometry, stroke footprint and device-pixel safety margin must fit every active native rectangle. Clip admission is viewport-bound. Unsupported but physically redundant clips remain explicit admission challenges, not wrong-symbol controls.',limitations:['Synthetic source admission/paint equivalence only; no matching accuracy or real-project approval']}};
}
