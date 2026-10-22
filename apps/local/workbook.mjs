import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';

export async function quantityWorkbook(state,takeoffId) {
  const takeoff=state.entities.find(e=>e.id===takeoffId&&e.kind==='takeoff');
  if(!takeoff)throw Object.assign(new Error('Takeoff not found'),{status:404});
  const disciplines=state.entities.filter(e=>e.parent_id===takeoffId&&e.kind==='discipline'),disciplineIds=new Set(disciplines.map(d=>d.id));
  const drawings=state.drawings.filter(d=>disciplineIds.has(d.discipline_id)),drawingIds=new Set(drawings.map(d=>d.id));
  const marks=state.countMarks.filter(m=>drawingIds.has(m.drawing_id)),measurements=state.measurements.filter(m=>drawingIds.has(m.drawing_id));
  const schedule=state.quantitySchedule||null, allocatedIds=schedule?new Set(schedule.filter(r=>drawingIds.has(r.drawing_id)).map(r=>r.source_id)):null;
  const pending=marks.filter(m=>m.included&&!m.reviewed&&(!allocatedIds||allocatedIds.has(m.id))).length;
  if(pending)throw Object.assign(new Error(`Review ${pending} included matches before exporting`),{status:409});
  if(measurements.some(m=>m.quantity.value===null&&(!allocatedIds||allocatedIds.has(m.id))))throw Object.assign(new Error('Set a scale on every page with length or area measurements before exporting'),{status:409});
  const workbook=new ExcelJS.Workbook();workbook.creator='Fire Take Off';workbook.created=new Date();
  const snapshotDigest=createHash('sha256').update(JSON.stringify({takeoff,disciplines,drawings,marks,measurements,zones:(state.zones||[]).filter(z=>drawingIds.has(z.drawing_id)),zoneHeadings:(state.zoneHeadings||[]).filter(h=>disciplineIds.has(h.discipline_id)),examples:(state.countExamples||[]).filter(e=>state.countItems.some(i=>i.id===e.item_id&&disciplineIds.has(i.discipline_id))),items:state.countItems.filter(i=>disciplineIds.has(i.discipline_id)),calibrations:state.calibrations.filter(c=>drawingIds.has(c.drawing_id)),events:(state.countEvents||[]).filter(e=>marks.some(m=>m.id===e.mark_id)),notes:state.notes.filter(n=>drawingIds.has(n.drawing_id)),pages:state.pageMetadata.filter(p=>drawingIds.has(p.drawing_id))})).digest('hex');
  function sheet(label,headings){const s=workbook.addWorksheet(label);s.addRow(headings);s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF13766F'}};s.views=[{state:'frozen',ySplit:1}];s.columns.forEach((c,i)=>c.width=i===0?28:22);return s;}
  const overview=sheet('Takeoff overview',['Field','Value']);overview.addRows([['Takeoff',takeoff.name],['Exported',new Date().toISOString()],['Snapshot SHA-256',snapshotDigest],['Drawings',drawings.length],['Disciplines',disciplines.length],['Included reviewed output matches',marks.filter(m=>m.included&&m.reviewed&&(!allocatedIds||allocatedIds.has(m.id))).length],['Excluded matches',marks.filter(m=>!m.included).length],['Measurement records',measurements.length]]);
  const drawingSheet=sheet('Drawing list',['Discipline','Source file','Page','Page name','Title','Source SHA-256','Uploaded']);
  for(const d of drawings)for(const p of d.pages){const metadata=state.pageMetadata.find(m=>m.drawing_id===d.id&&m.number===p.number);drawingSheet.addRow([disciplines.find(v=>v.id===d.discipline_id)?.name,d.name,p.number,metadata?.name||`Page ${p.number}`,metadata?.title||'',d.digest,d.created]);}
  const noteSheet=sheet('Notes',['Drawing','Page','Note','PDF X','PDF Y']);
  for(const n of state.notes.filter(n=>drawingIds.has(n.drawing_id)))noteSheet.addRow([drawings.find(d=>d.id===n.drawing_id)?.name,n.page,n.text,n.x,n.y]);
  const instances=sheet('Count instances',['Discipline','Item','Drawing','Page','Included','Reviewed','Origin','Image score','PDF X','PDF Y','Instance ID','Original item','Original item ID','Current item ID']);
  for(const m of marks){const i=state.countItems.find(i=>i.id===m.item_id),d=drawings.find(d=>d.id===m.drawing_id);instances.addRow([disciplines.find(v=>v.id===d.discipline_id)?.name,i?.name,d.name,m.page,m.included?'Yes':'No',m.reviewed?'Yes':'No',m.origin,m.score,m.x,m.y,m.id,state.countItems.find(i=>i.id===(m.original_item_id||m.item_id))?.name,m.original_item_id||m.item_id,m.item_id]);}
  const audit=sheet('Review history',['Instance ID','Action','Before included','After included','Version','Date','Before heading','After heading','Before item ID','After item ID']);
  for(const e of state.countEvents||[])if(marks.some(m=>m.id===e.mark_id))audit.addRow([e.mark_id,e.action,e.previous.included,e.current.included,e.current.version,e.created,state.countItems.find(i=>i.id===e.previous.item_id)?.name,state.countItems.find(i=>i.id===e.current.item_id)?.name,e.previous.item_id,e.current.item_id]);
  const usedNames=new Set(workbook.worksheets.map(s=>s.name.toLowerCase()));
  for(const discipline of disciplines){let label=discipline.name.replace(/[\\/*?:\[\]]/g,' ').replace(/^'+|'+$/g,'').slice(0,27)||'Discipline',suffix=1;const root=label;while(usedNames.has(label.toLowerCase()))label=root.slice(0,25)+' '+suffix++;usedNames.add(label.toLowerCase());
    const s=sheet(label,['Section','Item','Type','Unit','Drawing','Page','Quantity']);
    const zoned=(state.zones||[]).some(z=>drawings.some(d=>d.id===z.drawing_id&&d.discipline_id===discipline.id));
    if(zoned){
      const allocated=schedule.filter(r=>r.discipline_id===discipline.id),zoneIds=[...(state.zoneHeadings||[]).filter(h=>h.discipline_id===discipline.id).sort((a,b)=>a.position-b.position).map(h=>h.id)];
      if(allocated.some(r=>r.heading_id===null))zoneIds.push(null);
      zoneIds.forEach((id,i)=>{s.getCell(1,8+i).value=id===null?'Whole drawing':state.zoneHeadings.find(h=>h.id===id).name;s.getColumn(8+i).width=24;});
      const rows=new Map();for(const r of allocated){const key=JSON.stringify([r.section,r.item_id||r.source_id,r.drawing_id,r.page]);if(!rows.has(key))rows.set(key,{...r,total:0,zones:new Map()});const row=rows.get(key);row.total+=r.value;row.zones.set(r.heading_id,(row.zones.get(r.heading_id)||0)+r.value);}
      for(const r of rows.values())s.addRow([r.section,r.name,r.section==='Count'?'Automatic/manual count':r.kind,r.unit,drawings.find(d=>d.id===r.drawing_id).name,r.page,r.total,...zoneIds.map(id=>r.zones.get(id)||0)]);
      s.getColumn(7).numFmt='0.000';continue;
    }
    for(const item of state.countItems.filter(i=>i.discipline_id===discipline.id))for(const d of drawings.filter(d=>d.discipline_id===discipline.id))for(const p of d.pages){const quantity=marks.filter(m=>m.item_id===item.id&&m.drawing_id===d.id&&m.page===p.number&&m.included).length;if(quantity)s.addRow(['Count',item.name,'Automatic/manual count','ea',d.name,p.number,quantity]);}
    for(const m of measurements.filter(m=>drawings.find(d=>d.id===m.drawing_id)?.discipline_id===discipline.id))s.addRow(['Measure',m.name,m.kind,m.quantity.unit,drawings.find(d=>d.id===m.drawing_id).name,m.page,m.quantity.value]);
    s.getColumn(7).numFmt='0.000';
  }
  // All user text is assigned as string cells, never formulas or hyperlinks.
  return {bytes:Buffer.from(await workbook.xlsx.writeBuffer()),snapshotDigest};
}
