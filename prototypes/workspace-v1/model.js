/* Independent fictional-data model. No production imports or persistence. */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function fixture(){return {sheets:['01','02','RF'].map((n,k)=>({id:n,code:`FP-${k===2?'103':101+k}`,name:['Level 01','Level 02','Roof plant'][k],revision:['C','B','A'][k],notes:[],discipline:'Fire protection',scale:k===2?null:.05,checked:false,zones:[{id:'west',name:'West wing',x:140,y:180,w:700,h:390,factor:3},{id:'east',name:'East wing',x:760,y:180,w:460,h:390,factor:3}],marks:Array.from({length:12},(_,i)=>({id:`${n}-${i+1}`,x:[230,500,820,1100][i%4],y:[250,450,700][Math.floor(i/4)],category:i===8||i===9?'valve':'head',factor:i===8||i===9?1:2,included:i<10,reviewed:k===0?![1,4,6].includes(i):k===1?i!==2:true,origin:'Automatic'})),measure:{nativeLength:480,name:'Main pipe',zone:'west'}})),events:[]};}
 function zoneFor(sheet,mark){return sheet.zones.find(z=>mark.x>=z.x&&mark.x<=z.x+z.w&&mark.y>=z.y&&mark.y<=z.y+z.h)||null;}
 function totals(sheet){const inc=sheet.marks.filter(m=>m.included);const allocated=inc.filter(m=>zoneFor(sheet,m));return {raw:sheet.marks.length,included:inc.length,includedItems:inc.reduce((n,m)=>n+m.factor,0),allocated:allocated.length,allocatedItems:allocated.reduce((n,m)=>n+m.factor*zoneFor(sheet,m).factor,0),outside:inc.length-allocated.length,excluded:sheet.marks.length-inc.length,pending:allocated.filter(m=>!m.reviewed).length,pendingAll:inc.filter(m=>!m.reviewed).length,metres:sheet.scale===null?null:sheet.measure.nativeLength*sheet.scale*(sheet.zones.find(z=>z.id===sheet.measure.zone)?.factor||1)};}
 function readiness(state){const rows=state.sheets.map(s=>({id:s.id,...totals(s)}));return {rows,pending:rows.reduce((n,r)=>n+r.pending,0),unscaled:state.sheets.filter(s=>s.scale===null).length,unchecked:state.sheets.filter(s=>!s.checked).length,eligible:rows.every(r=>r.pending===0&&r.metres!==null)};}
 function change(state,action){const next=clone(state),sheet=next.sheets.find(s=>s.id===action.sheet);if(!sheet)throw Error('Choose a drawing first.');let mark;
 if(['review','exclude','restore','factor','classify'].includes(action.type)){mark=sheet.marks.find(m=>m.id===action.mark);if(!mark)throw Error('This result no longer exists.');}
 switch(action.type){
 case'review':mark.reviewed=true;break;
 case'exclude':mark.included=false;mark.reviewed=true;break;
 case'restore':mark.included=true;mark.reviewed=false;break;
 case'factor':if(!Number.isInteger(action.value)||action.value<1||action.value>10)throw Error('Enter a whole number from 1 to 10.');mark.factor=action.value;break;
 case'classify':if(!['head','valve'].includes(action.value))throw Error('Choose a valid classification.');mark.category=action.value;break;
 case'add':if(!Number.isFinite(action.x)||!Number.isFinite(action.y)||action.x<80||action.x>1320||action.y<100||action.y>810)throw Error('Place the result inside the drawing boundary.');sheet.marks.push({id:`${sheet.id}-manual-${sheet.marks.length+1}`,x:action.x,y:action.y,category:'head',factor:1,included:true,reviewed:true,origin:'Manual'});break;
 case'calibrate':if(!Number.isFinite(action.value)||action.value<=0||action.value>1000)throw Error('Enter a known distance greater than 0 and no more than 1000 metres.');sheet.scale=action.value/200;break;
 case'zone-factor':if(!Number.isInteger(action.value)||action.value<1||action.value>10)throw Error('Zone factor must be a whole number from 1 to 10.');{const z=sheet.zones.find(z=>z.id===action.zone);if(!z)throw Error('Choose a zone.');z.factor=action.value;}break;
 case'zone-order':sheet.zones.reverse();break;
 case'check':sheet.checked=action.value===true;break;
 case'note':if(!String(action.value||'').trim()||String(action.value).length>300)throw Error('Enter a note of 1–300 characters.');sheet.notes.push({x:action.x,y:action.y,text:String(action.value).trim()});break;
 default:throw Error('This prototype action is not supported.');
 }
 next.events.push({type:action.type,sheet:sheet.code,record:action.mark||action.zone||'',sequence:next.events.length+1});return next;
 }
 function history(initial){let state=clone(initial),past=[],future=[];return {get state(){return state;},get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},apply(a){const next=change(state,a);past.push(state);future=[];state=next;return state;},undo(){if(past.length){future.push(state);state=past.pop();}return state;},redo(){if(future.length){past.push(state);state=future.pop();}return state;},reset(){state=clone(initial);past=[];future=[];}};}
 function layout(mode,width){return mode==='auto'?(width<1600?'compact':'a'):mode;}
 root.FTOStudy={fixture,zoneFor,totals,readiness,change,history,layout};
})(globalThis);
