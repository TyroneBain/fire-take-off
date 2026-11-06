// Original native-coordinate fill candidate kernel. This does not trace pixels,
// accept detections, or change original paint identities. The caller must use
// audited opaque PDF geometry and verify every proposed original paint set.
export const FILL_EQUIVALENCE_VERSION = 'native-fill-union-candidate-1';
const LIMITS = Object.freeze({elements:50000, sourceElements:128, groupElements:128, edges:4096, values:2000000, work:2000000, maxWork:20000000, candidates:512});
const error = (message, code='VECTOR_FILL_INVALID') => Object.assign(Error(message), {code});
const unsupported = message => error(message, 'VECTOR_FILL_UNSUPPORTED');
const finite = n => Number.isFinite(n) && Math.abs(n) <= 1e7;
const same = (a,b) => a[0] === b[0] && a[1] === b[1];
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on = (a,b,p) => cross(a,b,p) === 0 && p[0] >= Math.min(a[0],b[0]) && p[0] <= Math.max(a[0],b[0]) && p[1] >= Math.min(a[1],b[1]) && p[1] <= Math.max(a[1],b[1]);
const intersects = (a,b) => cross(a[0],a[1],b[0])*cross(a[0],a[1],b[1]) < 0 && cross(b[0],b[1],a[0])*cross(b[0],b[1],a[1]) < 0 || on(...a,b[0]) || on(...a,b[1]) || on(...b,a[0]) || on(...b,a[1]);
const box = points => {const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of points){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;};
const overlap = (a,b) => a[0]<=b[2] && b[0]<=a[2] && a[1]<=b[3] && b[1]<=a[3];
const rotate = (p,a) => a===0?[...p]:a===90?[-p[1],p[0]]:a===180?[-p[0],-p[1]]:[p[1],-p[0]];
const styleKey = e => e.style.fill.toLowerCase()+'|'+e.style.rule;

/**
 * First supported family: one connected region, optionally containing holes,
 * assembled from complete opaque straight fill-only operations of one colour
 * and fill rule. Stroke/hairline semantics are never dropped. Same-colour
 * target bounding-box components are deliberately conservative: connected
 * background can prevent a proposal, but cannot be cut away to manufacture one.
 * Returns pending candidates only. Unsupported source returns []; malformed
 * input, cancellation and exhausted work throw, never publish partial results.
 */
export function findFillEquivalentMatches(page, template, {polygonBoolean, cancelled=()=>false, rotations=true, tolerance=.05, maxWork=LIMITS.work, scaleRange=null}={}) {
  if(!page?.supported || !template?.supported || !Array.isArray(page.elements) || !Array.isArray(template.elements) || !template.elements.length)throw error('Invalid supported fill source or target');
  if(!polygonBoolean || ['union','intersection','difference','xor'].some(k=>typeof polygonBoolean[k]!=='function') || typeof cancelled!=='function' || typeof rotations!=='boolean' || !Number.isFinite(tolerance) || tolerance<=0 || tolerance>.05 || !Number.isSafeInteger(maxWork) || maxWork<1 || maxWork>LIMITS.maxWork || scaleRange!==null)throw error('Invalid fill candidate options');
  if(!Array.isArray(template.anchor) || template.anchor.length!==2 || template.anchor.some(n=>!finite(n)))throw error('Invalid original fill anchor');
  let work=0, values=0;
  const tick=(n=1)=>{if(cancelled())throw error('Fill candidate search cancelled','VECTOR_FILL_CANCELLED');work+=n;if(work>maxWork)throw error('Fill candidate work budget exceeded','VECTOR_FILL_BUDGET');};
  const bool=(kind,...regions)=>{
    const count=regions.reduce((n,g)=>n+g.reduce((s,p)=>s+p.reduce((v,r)=>v+r.length,0),0),0);
    if(count>LIMITS.edges)throw error('Fill Boolean input budget exceeded','VECTOR_FILL_BUDGET');
    tick(count*count+1);const result=polygonBoolean[kind](...regions);tick();
    let out=0;if(!Array.isArray(result))throw error('Invalid fill Boolean output');
    for(const polygon of result){if(!Array.isArray(polygon)||!polygon.length)throw error('Invalid fill polygon');for(const ring of polygon){if(!Array.isArray(ring)||ring.length<4||!same(ring[0],ring.at(-1)))throw error('Invalid fill boundary');for(const p of ring){if(++out>LIMITS.edges)throw error('Fill Boolean output budget exceeded','VECTOR_FILL_BUDGET');if(!Array.isArray(p)||p.length!==2||p.some(n=>!finite(n)))throw error('Invalid fill boundary coordinate');}}}
    return result;
  };
  const identity=(e,seen)=>{tick();if(!Number.isSafeInteger(e?.id)||e.id<0||seen.has(e.id))throw error('Duplicate or invalid original fill identity');seen.add(e.id);};
  const parse=e=>{
    tick();const s=e?.style;
    if(!s || !/^#[0-9a-f]{6}$/i.test(s.fill??'') || s.stroke!==null || s.width!==0 || !['evenodd','nonzero'].includes(s.rule) || e.opaque===false || e.wholeOperation===false || e.contextComplete===false)throw unsupported('Only complete opaque fill-only paths are supported');
    const commands=e.pathCommands;
    if(!Array.isArray(commands)||!commands.length||commands.some(n=>!finite(n)))throw error('Invalid original fill commands');
    values+=commands.length;if(values>LIMITS.values)throw error('Fill command storage budget exceeded','VECTOR_FILL_BUDGET');
    const loops=[];let points=null;
    for(let i=0;i<commands.length;){tick();const op=commands[i++];if(op===0||op===1){if(i+1>=commands.length||op===0&&points||op===1&&!points)throw unsupported('Only explicitly closed fill subpaths are supported');const p=[commands[i++],commands[i++]];if(op===0)points=[p];else if(!same(points.at(-1),p))points.push(p);}
      else if(op===4&&points){if(same(points[0],points.at(-1)))points.pop();if(points.length<3||points.length>LIMITS.edges)throw unsupported('Degenerate or excessive fill subpath');
        let area=0;for(let j=0;j<points.length;j++){const a=points[j],b=points[(j+1)%points.length],c=points[(j+2)%points.length];tick();area+=cross(points[0],a,b);if(cross(a,b,c)===0&&(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1])<0)throw unsupported('Retraced fill boundary');for(let k=j+2;k<points.length;k++){tick();if(j===0&&k===points.length-1)continue;if(intersects([a,b],[points[k],points[(k+1)%points.length]]))throw unsupported('Self-intersecting fill boundary');}}
        if(area===0)throw unsupported('Zero-area fill boundary');loops.push({points:[...points,points[0]],area});points=null;
      }else throw unsupported('Curved or open fill subpaths are unsupported');
    }
    if(points||!loops.length)throw unsupported('Only explicitly closed fill subpaths are supported');
    let region;
    if(s.rule==='evenodd')region=bool('xor',...loops.map(l=>[[l.points]]));
    else if(loops.every(l=>Math.sign(l.area)===Math.sign(loops[0].area)))region=bool('union',...loops.map(l=>[[l.points]]));
    else {
      // Opposite winding is safe here only for strictly nested/disjoint simple
      // loops. General overlapping winding arrangements stay unsupported.
      const inside=(p,ring)=>{let odd=false;for(let i=1;i<ring.length;i++){tick();const a=ring[i-1],b=ring[i];if(on(a,b,p))throw unsupported('Touching opposite-winding boundaries');if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;}return odd;};
      for(let i=0;i<loops.length;i++)for(let j=i+1;j<loops.length;j++)for(let a=1;a<loops[i].points.length;a++)for(let b=1;b<loops[j].points.length;b++){tick();if(intersects([loops[i].points[a-1],loops[i].points[a]],[loops[j].points[b-1],loops[j].points[b]]))throw unsupported('Intersecting compound nonzero fill boundaries');}
      const ordered=[...loops].sort((a,b)=>Math.abs(b.area)-Math.abs(a.area));region=[];
      for(const loop of ordered){let before=0;for(const outer of ordered){if(Math.abs(outer.area)<=Math.abs(loop.area))continue;if(inside(loop.points[0],outer.points))before+=Math.sign(outer.area);}const after=before+Math.sign(loop.area);if(before===0&&after!==0)region=region.length?bool('union',region,[[loop.points]]):bool('union',[[loop.points]]);else if(before!==0&&after===0)region=bool('difference',region,[[loop.points]]);}
    }
    if(!region.length)throw unsupported('Empty fill operation');
    return {id:e.id,key:styleKey(e),region,bounds:box(region.flat(2))};
  };
  tick();if(template.elements.length>LIMITS.sourceElements)return [];const source=[];const sourceIds=new Set();
  try{for(const e of template.elements){identity(e,sourceIds);source.push(parse(e));}}catch(e){if(e.code==='VECTOR_FILL_UNSUPPORTED')return [];throw e;}
  if(source.some(e=>e.key!==source[0].key))return [];
  // Capacity outside this optional kernel's admitted family must not interrupt
  // an already supported baseline search, especially for unsupported strokes.
  if(page.elements.length>LIMITS.elements)return [];
  const sourceRegion=bool('union',...source.map(e=>e.region));if(sourceRegion.length!==1)return [];
  const sourceBox=box(sourceRegion.flat(2)),sw=sourceBox[2]-sourceBox[0],sh=sourceBox[3]-sourceBox[1],extent=Math.max(sw,sh),cell=Math.max(extent,tolerance*4);
  const entries=[],seen=new Set(),buckets=new Map(),parent=[];
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(const element of page.elements){
    identity(element,seen);if(!element.style||element.style.fill?.toLowerCase()!==source[0].key.split('|')[0]||element.style.rule!==template.elements[0].style.rule)continue;
    let e;try{e=parse(element);}catch(ex){if(ex.code==='VECTOR_FILL_UNSUPPORTED')continue;throw ex;}
    if(e.bounds[2]-e.bounds[0]>extent+2*tolerance||e.bounds[3]-e.bounds[1]>extent+2*tolerance)continue;
    const i=entries.length;entries.push(e);parent.push(i);const neighbours=new Set();
    const x0=Math.floor(e.bounds[0]/cell),x1=Math.floor(e.bounds[2]/cell),y0=Math.floor(e.bounds[1]/cell),y1=Math.floor(e.bounds[3]/cell);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){tick();const key=x+','+y;for(const j of buckets.get(key)||[]){tick();neighbours.add(j);}if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
    for(const j of neighbours){tick();if(overlap(e.bounds,entries[j].bounds))parent[root(i)]=root(j);}
  }
  const groups=new Map();for(let i=0;i<entries.length;i++){tick();const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(entries[i]);}
  const distance=(p,ring)=>{let best=Infinity;for(let i=1;i<ring.length;i++){tick();const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0;best=Math.min(best,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return best;};
  const covered=(ring,other)=>{for(let i=1;i<ring.length;i++){const stack=[[ring[i-1],ring[i],0]];while(stack.length){tick();const [a,b,depth]=stack.pop(),da=distance(a,other),db=distance(b,other);if(da>tolerance||db>tolerance)return false;if((da+db+Math.hypot(a[0]-b[0],a[1]-b[1]))/2<=tolerance)continue;if(depth>=20)return false;const middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];stack.push([a,middle,depth+1],[middle,b,depth+1]);}}return true;};
  const equalRing=(a,b)=>covered(a,b)&&covered(b,a);
  const equal=(a,b)=>{if(a.length!==b.length||!equalRing(a[0],b[0]))return false;const used=new Set();for(let i=1;i<a.length;i++){const found=[];for(let j=1;j<b.length;j++)if(!used.has(j)&&equalRing(a[i],b[j]))found.push(j);if(found.length!==1)return false;used.add(found[0]);}return true;};
  const hits=[];
  for(const group of groups.values()){
    tick();if(group.length>LIMITS.groupElements)continue;const bounds=box(group.flatMap(e=>[[e.bounds[0],e.bounds[1]],[e.bounds[2],e.bounds[3]]]));if(bounds[2]-bounds[0]>extent+2*tolerance||bounds[3]-bounds[1]>extent+2*tolerance)continue;
    const region=bool('union',...group.map(e=>e.region));if(region.length!==1)continue;
    for(const angle of rotations?[0,90,180,270]:[0]){
      tick();const relative=sourceRegion[0].map(r=>r.map(p=>rotate([p[0]-template.anchor[0],p[1]-template.anchor[1]],angle))),rb=box(relative.flat()),tb=box(region.flat(2));
      if(Math.abs(rb[2]-rb[0]-tb[2]+tb[0])>2*tolerance||Math.abs(rb[3]-rb[1]-tb[3]+tb[1])>2*tolerance)continue;
      const offset=[(tb[0]+tb[2]-rb[0]-rb[2])/2,(tb[1]+tb[3]-rb[1]-rb[3])/2],placed=relative.map(r=>r.map(p=>[p[0]+offset[0],p[1]+offset[1]]));
      if(!equal(placed,region[0]))continue;
      const elementIds=group.map(e=>e.id).sort((a,b)=>a-b);
      hits.push({x:offset[0],y:offset[1],rotation:angle,elementIds,wholeOperations:true,requiresExplicitReview:true,requiresRenderVerification:true,geometryPolicy:FILL_EQUIVALENCE_VERSION});if(hits.length>LIMITS.candidates)throw error('Fill candidate count budget exceeded','VECTOR_FILL_BUDGET');break;
    }
  }
  tick();return hits.sort((a,b)=>a.y-b.y||a.x-b.x);
}
