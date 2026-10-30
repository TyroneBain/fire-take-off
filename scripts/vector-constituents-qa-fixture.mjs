import {createHash} from 'node:crypto';

// Original independent literal-PDF oracle, declared before candidate results.
// Each ring edge is a separate subpath even when painted in one operation:
// changing operation grouping therefore preserves its butt-cap geometry.
const points=[[-10,-4],[-4,-10],[4,-10],[10,-4],[10,4],[4,10],[-4,10],[-10,4]];
const segments=points.map((p,i)=>[...p,...points[(i+1)%points.length]]);
const positives=[
 {id:'source',x:70,y:70,grouping:'one',pipe:'horizontal'},
 {id:'same-grouping',x:150,y:70,grouping:'one'},
 {id:'split-paints',x:230,y:70,grouping:'each'},
 {id:'split-r90',x:310,y:70,grouping:'each',rotation:90,pipe:'horizontal'},
 {id:'split-r180',x:390,y:70,grouping:'each',rotation:180,pipe:'horizontal'},
 {id:'split-r270',x:470,y:70,grouping:'each',rotation:270,pipe:'horizontal'},
 {id:'reversed-and-reordered',x:70,y:170,grouping:'one',reversed:true,detailFirst:true},
 {id:'three-paints',x:150,y:170,grouping:'three'},
 {id:'reversed-r90',x:230,y:170,grouping:'one',reversed:true,rotation:90},
 {id:'pipe-merged-in-ring-paint',x:310,y:170,grouping:'one',pipe:'merged'},
 {id:'different-crossing-pipe',x:390,y:170,grouping:'each',pipe:'diagonal'},
 {id:'three-paints-reversed-r180',x:470,y:170,grouping:'three',reversed:true,rotation:180},
].map(p=>({...p,page:1,rotation:p.rotation||0}));
const negatives=[
 {id:'missing-centre',x:70,y:270,kind:'missing'},
 {id:'shifted-centre',x:150,y:270,kind:'shift'},
 {id:'extra-quarter',x:230,y:270,kind:'quarter'},
 {id:'extra-inner-ring',x:310,y:270,kind:'ring'},
 {id:'extra-spoke',x:390,y:270,kind:'spoke'},
 {id:'stroked-not-filled-centre',x:470,y:270,kind:'outline'},
 {id:'wrong-ring-stroke-width',x:70,y:370,kind:'width'},
 {id:'mirrored-centre-position',x:150,y:370,kind:'mirror'},
].map(p=>({...p,page:1,rotation:0,grouping:'one'}));
const matrix=angle=>({0:'1 0 0 1',90:'0 1 -1 0',180:'-1 0 0 -1',270:'0 -1 1 0'})[angle||0];
const edge=s=>`${s[0]} ${s[1]} m ${s[2]} ${s[3]} l`;
function glyph(s){
 const edges=s.reversed?[...segments].reverse().map(([a,b,c,d])=>[c,d,a,b]):segments;
 let groups=s.grouping==='each'?edges.map(e=>[e]):s.grouping==='three'?[edges.slice(0,3),edges.slice(3,6),edges.slice(6)]:[edges];
 const ring=groups.map((g,i)=>g.map(edge).join(' ')+(s.pipe==='merged'&&i===0?' -20 0 m 20 0 l':'')+' S').join(' ');
 let centre=[[-3.5,1],[-2,2.5],[-.5,1],[-2,-.5]];
 if(s.kind==='shift')centre=centre.map(([x,y])=>[x+.5,y]);
 if(s.kind==='mirror')centre=centre.map(([x,y])=>[-x,y]);
 if(s.reversed)centre.reverse();
 const detail=s.kind==='missing'?'':centre.map(([x,y],i)=>`${x} ${y} ${i?'l':'m'}`).join(' ')+` h ${s.kind==='outline'?'S':'f'}`;
 const extra=s.kind==='quarter'?'3 3 m 7 3 l 3 7 l h f':s.kind==='ring'?'-6 -6 m 6 -6 l 6 6 l -6 6 l h S':s.kind==='spoke'?'3 0 m 8 0 l S':'';
 const pipe=s.pipe==='horizontal'?'.6 w -20 0 m 20 0 l S':s.pipe==='diagonal'?'.6 w -20 -20 m 20 20 l S':'';
 return `q ${matrix(s.rotation)} ${s.x} ${s.y} cm 0 G 0 g ${s.kind==='width'?1.2:.8} w 0 J 0 j ${s.detailFirst?detail+' '+ring:ring+' '+detail} ${extra} ${pipe} Q`;
}
function pdf(contents){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${contents.map((_,i)=>`${3+i*2} 0 R`).join(' ')}] /Count ${contents.length} >>`];
 for(const[i,content]of contents.entries())objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 430] /Resources << >> /Contents ${4+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
 let out='%PDF-1.4\n';const offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out);
}
export function constituentQaFixture(){
 const clipped={id:'clipped-positive',page:2,x:70,y:70,grouping:'each',rotation:0};
 const capSource='q 1 0 0 1 70 70 cm 0 G 2 w 0 J 0 j -10 -10 m 10 -10 l 10 10 l -10 10 l h S Q';
 const capNegative='q 1 0 0 1 150 70 cm 0 G 2 w 0 J 0 j -10 -10 m 10 -10 l S 10 -10 m 10 10 l S 10 10 m -10 10 l S -10 10 m -10 -10 l S Q';
 const bytes=pdf([[...positives,...negatives].map(glyph).join('\n'),`q 40 40 60 60 re W n ${glyph(clipped)} Q`,capSource+'\n'+capNegative]);
 return {bytes,manifest:{id:'independent-constituents-v1',sha256:createHash('sha256').update(bytes).digest('hex'),provenance:'Original independently declared PDF geometry; no customer or competitor assets',labels:[...positives.map(p=>({...p})),clipped],negatives:negatives.map(p=>({...p})),selection:[56,56,84,84],anchor:[70,70],sourcePage:1,excludedNativeBounds:[[50,70,90,70]],sourceElementRule:'Use actual extracted operation IDs intersecting selection, including excluded pipe; exclude exactly the declared native pipe bounds',tolerancePdfPoints:.05,unsupportedPages:[{page:2,id:clipped.id,reason:'Visible true symbol under structural clipping; current vector extraction must explicitly fall back, never pretend this target does not exist'}],capJoinControl:{page:3,selection:[56,56,84,84],anchor:[70,70],positive:[70,70],negative:[150,70],reason:'Closed miter-joined stroked square differs from four independently butt-capped edges despite identical centrelines; physical corner ink must not be declared equivalent'},limitations:['Synthetic geometry only; no real-drawing or Countfire accuracy claim','Merged-pipe and different-crossing-pipe labels are true glyph positives even if current whole-operation/exclusion policy misses them','Main geometric stroke paths use disconnected subpaths in both grouped and split encodings; cap/join adversary is reported separately','Page2 unsupported positive remains in overall recall; page3 is a distinct standalone physical-render safety control']}};
}

export function quantizedConstituentFixture(){
 const points=[];for(let i=0;i<64;i++){const a=i*Math.PI/32,p=[Math.round(2.4*Math.cos(a)/.24)*.24,Math.round(2.4*Math.sin(a)/.24)*.24].map(v=>+v.toFixed(6));if(!points.length||p.some((v,j)=>v!==points.at(-1)[j]))points.push(p);}
 if(points[0].every((v,j)=>v===points.at(-1)[j]))points.pop();
 const edges=points.map((p,i)=>[...p,...points[(i+1)%points.length]]);
 const draw=(x,{reverseOrder=false,shift=0}={})=>`q 1 0 0 1 ${x} 16 cm 0 G .08 w ${[...(reverseOrder?[...edges].reverse():edges)].map(edge).join(' ')} S 1 0 0 rg ${-.3+shift} -.2 m ${.3+shift} -.2 l ${shift} .4 l h f Q`;
 return {bytes:pdf([draw(16)+'\n'+draw(64,{reverseOrder:true})+'\n'+draw(112,{shift:.12})]),manifest:{id:'independent-quantized-constituents-v1',selection:[12,12,20,20],anchor:[16,16],positiveAnchors:[[16,16],[64,16]],negativeAnchor:[112,16],negativeDetailShift:.12,quantization:.24,polygonSegments:edges.length,explicitToleranceChecks:[.05,.12,.24,.25],defaultTolerance:.05,oracle:'Original radius2.4 polygon rounded to0.24-grid, with separate filled triangle pivot. Identical polygon with reversed edge order is positive; centre shifted0.12 is negative at unchanged default0.05. Larger tolerances are diagnostic, not approved policy changes.'}};
}
