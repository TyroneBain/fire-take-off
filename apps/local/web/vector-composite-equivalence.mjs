import {findFillEquivalentMatches} from './vector-fill-equivalence.mjs';

// Native candidate evidence only. Fill area and stroke paths are independent
// paint channels: a zero-width stroke is a PDF hairline, never an empty region.
export const COMPOSITE_EQUIVALENCE_VERSION = 'native-composite-subpaths-candidate-1';
const LIMITS = Object.freeze({elements:50000, source:128, atoms:4096, values:2000000, candidates:512, work:2000000, maxWork:20000000});
const failure = (message, code='VECTOR_COMPOSITE_INVALID') => Object.assign(Error(message), {code});
const unsupported = message => failure(message, 'VECTOR_COMPOSITE_UNSUPPORTED');
const finite = n => Number.isFinite(n) && Math.abs(n)<=1e7;
const colour = s => typeof s==='string' && /^#[0-9a-f]{6}$/i.test(s);
const rotate = (x,y,a) => a===0?[x,y]:a===90?[-y,x]:a===180?[-x,-y]:[y,-x];
const bounds = points => {const b=[Infinity,Infinity,-Infinity,-Infinity];for(const [x,y] of points){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}return b;};
const centre = b => [(b[0]+b[2])/2,(b[1]+b[3])/2];
const samePoint = (a,b) => a[0]===b[0] && a[1]===b[1];
const strokeStyleKey = style => [style.stroke?.toLowerCase(),style.width,style.cap,style.join,style.miter].join('|');
const strokeKey = (style,subpath) => [strokeStyleKey(style),subpath.closed?1:0,subpath.ops.join(',')].join('|');

/**
 * Regroup complete native operations without changing their stroked subpaths.
 * Supports a single connected same-colour straight fill region plus explicit
 * line/Bezier stroke evidence. Closed-subpath start and traversal must match;
 * this deliberately does not fit circles, merge strokes, expand hairlines, or
 * equate a triangulated hairline fill with one filled outline. No scaling.
 *
 * The caller supplies audited opaque whole operations and verifies original
 * target paint IDs afterwards. Extra unselected target paint is not adjudicated
 * here, so every supplement remains pending explicit review.
 * Unsupported/capacity cases return []; cancellation and consumed work budgets
 * throw atomically. At most four bounded fill searches are performed, each with
 * maxWork, in addition to a maxWork-bounded stroke search.
 */
export function findCompositeEquivalentMatches(page,template,{polygonBoolean,cancelled=()=>false,rotations=true,tolerance=.05,maxWork=LIMITS.work,scaleRange=null}={}) {
  if(!page?.supported || !template?.supported || !Array.isArray(page.elements) || !Array.isArray(template.elements) || !template.elements.length)throw failure('Invalid supported composite source or target');
  if(!polygonBoolean || ['union','intersection','difference','xor'].some(k=>typeof polygonBoolean[k]!=='function') || typeof cancelled!=='function' || typeof rotations!=='boolean' || !Number.isFinite(tolerance) || tolerance<=0 || tolerance>.05 || !Number.isSafeInteger(maxWork) || maxWork<1 || maxWork>LIMITS.maxWork || scaleRange!==null)throw failure('Invalid composite candidate options');
  if(!Array.isArray(template.anchor) || template.anchor.length!==2 || template.anchor.some(n=>!finite(n)))throw failure('Invalid original composite anchor');
  let work=0, values=0;
  const tick=(n=1)=>{if(cancelled())throw failure('Composite candidate search cancelled','VECTOR_COMPOSITE_CANCELLED');work+=n;if(work>maxWork)throw failure('Composite candidate work budget exceeded','VECTOR_COMPOSITE_BUDGET');};
  const identity=(e,seen)=>{tick();if(!Number.isSafeInteger(e?.id)||e.id<0||seen.has(e.id))throw failure('Invalid or duplicate original composite identity');seen.add(e.id);};
  const parse=e=>{
    tick();const s=e.style;
    if(!s || !(s.fill===null||colour(s.fill)) || !(s.stroke===null||colour(s.stroke)) || s.fill===null&&s.stroke===null || !Number.isFinite(s.width)||s.width<0 || ![0,1,2].includes(s.cap)||![0,1,2].includes(s.join)||!Number.isFinite(s.miter)||s.miter<0 || !['nonzero','evenodd'].includes(s.rule) || e.opaque===false || e.wholeOperation===false || e.contextComplete===false)throw unsupported('Only complete opaque native paths are supported');
    const commands=e.pathCommands;
    if(!Array.isArray(commands)||!commands.length||commands.some(n=>!finite(n)))throw failure('Invalid original composite commands');
    values+=commands.length;if(values>LIMITS.values)throw failure('Composite command budget exceeded','VECTOR_COMPOSITE_BUDGET');
    const subpaths=[];let current=null;
    const finish=()=>{if(current){if(!current.ops.length)throw unsupported('Empty native subpath');subpaths.push(current);current=null;}};
    for(let i=0;i<commands.length;){
      tick();const op=commands[i++];
      if(op===4){if(!current)throw unsupported('Close without a native subpath');current.closed=true;continue;}
      const size=op===0||op===1?2:op===2?6:op===3?4:0;
      if(!size||i+size>commands.length)throw failure('Invalid native path command');
      const coords=commands.slice(i,i+size);i+=size;
      if(op===0){finish();current={ops:[],points:[coords],closed:false};}
      else {if(!current||current.closed)throw unsupported('Continuation after closed native subpath');current.ops.push(op);for(let j=0;j<coords.length;j+=2)current.points.push(coords.slice(j,j+2));}
    }
    finish();if(subpaths.length>LIMITS.atoms)throw unsupported('Excessive native subpath count');
    // PDF close-and-paint operators close the current (last) subpath even when
    // the path command list has no explicit close. Preserve that stroke join.
    if(e.paintClosesPath===true)subpaths.at(-1).closed=true;
    const fillLoops=[],strokes=[];
    for(let i=0;i<subpaths.length;i++){
      tick();const p=subpaths[i];
      if(s.stroke!==null)strokes.push({...p,id:e.id,index:i,key:strokeKey(s,p),bounds:bounds(p.points)});
      if(s.fill!==null){
        if(!p.closed||p.ops.some(op=>op!==1))throw unsupported('Only explicitly closed straight fill subpaths are supported');
        const ps=p.points,other=ps.find(q=>!samePoint(q,ps[0]));
        // Only proven collinearity permits omitting zero area from the fill
        // channel. Its full stroked path remains mandatory above. A bow-tie or
        // any other zero-signed-area path is not treated as invisible.
        const collinear=!other||ps.every(q=>(other[0]-ps[0][0])*(q[1]-ps[0][1])-(other[1]-ps[0][1])*(q[0]-ps[0][0])===0);
        if(collinear){if(s.stroke===null)throw unsupported('Degenerate fill without stroke evidence');continue;}
        fillLoops.push(ps);
      }
    }
    // Some CAD exports pair adjacent triangles with opposite winding. For
    // triangles only, prove their interiors disjoint before normalizing fill
    // orientation. Shared edges have no fill area; stroked paths above retain
    // their original direction, closure, multiplicity and hairline style.
    const triangle=ps=>{const p=samePoint(ps[0],ps.at(-1))?ps.slice(0,-1):ps;return p.length===3?p:null;};
    const triangles=fillLoops.map(triangle);
    if(s.rule==='nonzero'&&triangles.length>1&&triangles.every(Boolean)){
      const area=p=>(p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]);
      for(let i=0;i<triangles.length;i++)for(let j=i+1;j<triangles.length;j++){
        tick();if(Math.sign(area(triangles[i]))===Math.sign(area(triangles[j])))continue;
        tick(64);const intersection=polygonBoolean.intersection([[...triangles[i],triangles[i][0]]],[[...triangles[j],triangles[j][0]]]);tick();
        if(!Array.isArray(intersection))throw failure('Invalid native triangle intersection');
        if(intersection.length)throw unsupported('Overlapping opposite-winding native triangles');
      }
      for(let i=0;i<triangles.length;i++)fillLoops[i]=area(triangles[i])<0?[...triangles[i]].reverse():triangles[i];
    }
    const fillCommands=fillLoops.flatMap(ps=>[0,...ps[0],...ps.slice(1).flatMap(q=>[1,...q]),4]);
    return {id:e.id,strokes,fill:fillCommands.length?{...e,style:{...s,stroke:null,width:0},pathCommands:fillCommands}:null,bounds:bounds(subpaths.flatMap(p=>p.points))};
  };
  tick();if(template.elements.length>LIMITS.source)return [];
  const source=[],sourceIds=new Set();
  try{for(const e of template.elements){identity(e,sourceIds);source.push(parse(e));}}catch(e){if(e.code==='VECTOR_COMPOSITE_UNSUPPORTED')return [];throw e;}
  const sourceFills=source.map(e=>e.fill).filter(Boolean),sourceStrokes=source.flatMap(e=>e.strokes);
  if(!sourceFills.length||!sourceStrokes.length||sourceStrokes.length>LIMITS.atoms)return [];
  const first=sourceFills[0].style;
  if(sourceFills.some(e=>e.style.fill.toLowerCase()!==first.fill.toLowerCase()||e.style.rule!==first.rule))return [];
  if(page.elements.length>LIMITS.elements)return [];
  const sourceBox=bounds(source.flatMap(e=>[[e.bounds[0],e.bounds[1]],[e.bounds[2],e.bounds[3]]])),extent=Math.max(sourceBox[2]-sourceBox[0],sourceBox[3]-sourceBox[1]);
  const sourceKeys=new Set(sourceStrokes.map(p=>p.key)),sourceStyles=new Set(template.elements.filter(e=>e.style.stroke!==null).map(e=>strokeStyleKey(e.style))),target=new Map(),targetFills=[],buckets=new Map(),seen=new Set(),cell=Math.max(extent,tolerance*4);
  for(const e of page.elements){
    identity(e,seen);
    // Preserve unrelated page geometry without parsing it into this optional
    // family; original operations with other paint are never trimmed to fit.
    if(!e.style || e.style.fill!==null&&(e.style.fill?.toLowerCase()!==first.fill.toLowerCase()||e.style.rule!==first.rule))continue;
    if(e.style.stroke!==null&&!sourceStyles.has(strokeStyleKey(e.style)))continue;
    let p;try{p=parse(e);}catch(ex){if(ex.code==='VECTOR_COMPOSITE_UNSUPPORTED')continue;throw ex;}
    if(p.bounds[2]-p.bounds[0]>extent+2*tolerance||p.bounds[3]-p.bounds[1]>extent+2*tolerance||p.strokes.length>sourceStrokes.length||p.strokes.some(a=>!sourceKeys.has(a.key)))continue;
    target.set(p.id,p);if(p.fill)targetFills.push(p.fill);
    for(const atom of p.strokes){tick();const [x,y]=centre(atom.bounds),key=atom.key+'@'+Math.floor(x/cell)+','+Math.floor(y/cell);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(atom);}
  }
  const posed=(p,angle,offset=[0,0])=>p.points.map(([x,y])=>{const q=rotate(x-template.anchor[0],y-template.anchor[1],angle);return[q[0]+offset[0],q[1]+offset[1]];});
  const rotateFill=(e,angle)=>{
    const commands=[];for(let i=0;i<e.pathCommands.length;){const op=e.pathCommands[i++];commands.push(op);if(op!==4){const p=rotate(e.pathCommands[i++]-template.anchor[0],e.pathCommands[i++]-template.anchor[1],angle);commands.push(...p);}}
    return {...e,pathCommands:commands};
  };
  const hits=[],emitted=new Set();
  for(const angle of rotations?[0,90,180,270]:[0]){
    tick();let fills;
    try{fills=findFillEquivalentMatches({supported:true,elements:targetFills},{supported:true,elements:sourceFills.map(e=>rotateFill(e,angle)),anchor:[0,0]},{polygonBoolean,cancelled,rotations:false,tolerance,maxWork});}
    catch(e){if(typeof e.code==='string'&&e.code.startsWith('VECTOR_FILL_'))throw failure(e.message,e.code.replace('VECTOR_FILL_','VECTOR_COMPOSITE_'));throw e;}
    for(const hit of fills){
      tick();const used=new Set(),ids=new Set(hit.elementIds);let valid=true;
      // Complex outlines before repeated triangles reduces ambiguous duplicate
      // choices. Greedy refusal is conservative; there is no exponential search.
      const ordered=[...sourceStrokes].sort((a,b)=>b.points.length-a.points.length||a.id-b.id||a.index-b.index);
      for(const sourceAtom of ordered){
        tick();const points=posed(sourceAtom,angle,[hit.x,hit.y]),[cx,cy]=centre(bounds(points)),choices=[];
        for(let y=Math.floor((cy-tolerance)/cell);y<=Math.floor((cy+tolerance)/cell);y++)for(let x=Math.floor((cx-tolerance)/cell);x<=Math.floor((cx+tolerance)/cell);x++){
          tick();for(const atom of buckets.get(sourceAtom.key+'@'+x+','+y)||[]){
            tick();const key=atom.id+':'+atom.index;if(used.has(key)||atom.points.length!==points.length)continue;
            let distance=0;for(let i=0;i<points.length;i++){tick();distance=Math.max(distance,Math.hypot(points[i][0]-atom.points[i][0],points[i][1]-atom.points[i][1]));if(distance>tolerance)break;}
            if(distance<=tolerance)choices.push({atom,key,distance});
          }
        }
        choices.sort((a,b)=>a.distance-b.distance||a.atom.id-b.atom.id||a.atom.index-b.atom.index);
        if(!choices.length){valid=false;break;}
        used.add(choices[0].key);ids.add(choices[0].atom.id);
      }
      if(!valid||ids.size>LIMITS.source)continue;
      const fillIds=new Set(hit.elementIds);
      for(const id of ids){tick();const e=target.get(id);if(!e||e.fill&&!fillIds.has(id)||e.strokes.some(a=>!used.has(id+':'+a.index))){valid=false;break;}}
      if(!valid)continue;
      const elementIds=[...ids].sort((a,b)=>a-b),key=elementIds.join(',');if(emitted.has(key))continue;emitted.add(key);
      hits.push({x:hit.x,y:hit.y,rotation:angle,elementIds,wholeOperations:true,requiresExplicitReview:true,requiresRenderVerification:true,geometryPolicy:COMPOSITE_EQUIVALENCE_VERSION});
      if(hits.length>LIMITS.candidates)throw failure('Composite candidate count budget exceeded','VECTOR_COMPOSITE_BUDGET');
    }
  }
  tick();return hits.sort((a,b)=>a.y-b.y||a.x-b.x||a.rotation-b.rotation);
}
