export function countGroupSections(state,disciplineId,items,filter=''){
 const groups=(state.countGroups||[]).filter(g=>g.discipline_id===disciplineId).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)),members=new Map((state.countGroupMembers||[]).map(m=>[m.item_id,m.group_id])),ids=new Set(groups.map(g=>g.id)),query=filter.trim().toLowerCase();
 if(!groups.length)return [{id:null,name:'',items:items.filter(i=>i.name.toLowerCase().includes(query))}];
 return [...groups,{id:null,name:'Misc'}].map(g=>({...g,items:items.filter(i=>(ids.has(members.get(i.id))?members.get(i.id):null)===g.id&&(g.name.toLowerCase().includes(query)||i.name.toLowerCase().includes(query)))})).filter(g=>!query||g.items.length||g.name.toLowerCase().includes(query));
}
