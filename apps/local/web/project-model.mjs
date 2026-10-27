export const LOCAL_OWNER='Local user';
export const PROJECT_STATUSES=['Takeoff','Estimate','Client review','Won','Lost','On hold'];
export function projectRows(state,{scope='active',filter='',sort='created',direction=-1}={}){
  const query=filter.trim().toLocaleLowerCase();
  return state.entities.filter(e=>e.kind==='project').map(e=>({...e,...state.projectMetadata.find(m=>m.project_id===e.id)}))
    .filter(p=>scope==='archived'?p.archived:!p.archived&&(scope!=='own'||p.owner===LOCAL_OWNER))
    .filter(p=>[p.name,p.customer,p.building_type,p.owner,p.status].some(s=>s.toLocaleLowerCase().includes(query)))
    .sort((a,b)=>{
      const av=a[sort]??'',bv=b[sort]??'';
      // Missing dates stay last regardless of direction.
      if(sort==='due_date'&&(!av||!bv))return av?-1:bv?1:a.id.localeCompare(b.id);
      return String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'})*direction||a.id.localeCompare(b.id);
    });
}
