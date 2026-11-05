import {createHash} from 'node:crypto';
// Independent original placement oracle, declared without matcher output.
// The fifth head remains a positive class instance despite later white paint;
// it is deliberately ineligible for automatic original-paint acceptance.
export const MULTIPAGE_QA_LABELS=Object.freeze([
 {id:'page1-source',page:1,x:40,y:40,rotation:0,verified:true},
 {id:'page1-half-turn',page:1,x:110,y:40,rotation:180,verified:true},
 {id:'page2-quarter-turn',page:2,x:40,y:40,rotation:90,verified:true},
 {id:'page2-three-quarter-turn',page:2,x:110,y:40,rotation:270,verified:true},
 {id:'page2-overpaint',page:2,x:180,y:40,rotation:0,verified:false,challenge:'Later opaque white paint removes original centre detail; manual review only'},
]);
export const MULTIPAGE_QA_NEGATIVES=Object.freeze([
 {id:'page1-red-centre',page:1,x:180,y:40,rotation:0},
 {id:'page2-red-centre',page:2,x:230,y:40,rotation:90},
]);
const transforms={0:'1 0 0 1',90:'0 1 -1 0',180:'-1 0 0 -1',270:'0 -1 1 0'};
const head=(p,red=false)=>`q ${transforms[p.rotation]} ${p.x} ${p.y} cm 0 G 0 g 1 w -4 -4 8 8 re S ${red?'1 0 0 rg':''} -1 -1 m 1 -1 l 0 1 l h f Q`;
function literalPdf(contents){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${contents.map((_,i)=>`${3+2*i} 0 R`).join(' ')}] /Count ${contents.length} >>`];
 for(const[i,content]of contents.entries())objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 260 100] /Resources << >> /Contents ${4+2*i} 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
 let out='%PDF-1.4\n',offsets=[0];for(const[i,obj]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${obj}\nendobj\n`;}const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out);
}
export function vectorMultipageQaFixture(){
 // Page1 source pipe first, opaque white annulus/background next, retained
 // glyph last. Native picking may touch only the pipe's actually visible ink.
 const page1=['0 G 1 w 20 40 m 60 40 l S','1 g 36.5 36.5 7 7 re f',...MULTIPAGE_QA_LABELS.filter(p=>p.page===1).map(p=>head(p)),head(MULTIPAGE_QA_NEGATIVES[0],true)].join('\n');
 // Three remote paints intentionally change page2 operator identities. None
 // intersects a head or defines its geometry.
 const page2=['0 g 4 4 2 2 re f','0 G 1 w 8 8 m 12 8 l S','0 g 16 4 2 2 re f',...MULTIPAGE_QA_LABELS.filter(p=>p.page===2).map(p=>head(p)),head(MULTIPAGE_QA_NEGATIVES[1],true),'1 g 179.5 39.5 1 1 re f'].join('\n');
 const bytes=literalPdf([page1,page2]);return{bytes,manifest:{id:'independent-native-multipage-v1',sha256:createHash('sha256').update(bytes).digest('hex'),provenance:'Original independently authored literal PDF and placement labels; no customer or competitor content.',pages:2,pageBounds:[0,0,260,100],source:{page:1,bounds:[34,34,46,46],anchor:[40,40],pipeClicks:[[45.5,40]],expectedNonwhiteElements:3,expectedRetainedElements:2,paintOrdinals:{pipe:0,whiteBackground:1,retained:[2,3]},cleaning:'Exclude only the whole first pipe paint. Keep both outer-square stroke and filled-triangle paint. Preserve white original background context.'},layerPolicy:'all-admitted',labels:structuredClone(MULTIPAGE_QA_LABELS),negatives:structuredClone(MULTIPAGE_QA_NEGATIVES),expected:{geometryByPage:[2,3],verifiedByPage:[2,2],geometryTotal:5,verifiedTotal:4,manualMiss:[180,40],manualPage:2},paintOrdinalsByPage:{1:{positive:[[2,3],[4,5]],negative:[[6,7]]},2:{positive:[[3,4],[5,6],[7,8]],negative:[[9,10]],overpaint:11}},scoring:'Page-qualified one-to-one centres within .1 native point; every commanded original head counts once across allowed quarter turns. White-overpaint head is a geometry positive but strict visibility refusal.',uiLedger:{draftReject:'page1-half-turn',excludeAfterApply:'page2-three-quarter-turn',reclassify:'page2-quarter-turn',manualAdd:'page2-overpaint',expectedFinalInstances:5,expectedFinalIncluded:3,expectedIncludedByPage:{1:1,2:2}},limitations:['Synthetic acceptance fixture only; not real-drawing or general accuracy evidence.','All-admitted explicit scope; no cross-document or layer-name equivalence claim.','The two pages share a coordinate intentionally; page-qualified physical paint identities must remain distinct.']}};
}
