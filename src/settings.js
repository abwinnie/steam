import {catalysts,clampPercent,calculateSimulation} from './chemistry.js';
export function createSettings(){
 const state={h2o2:30,catalystId:'ki',concentrations:Object.fromEntries(Object.keys(catalysts).map(id=>[id,10]))};
 return {state,setH2o2(value){state.h2o2=clampPercent(value);},select(id){if(!catalysts[id])throw new RangeError('未知催化系統');state.catalystId=id;},setConcentration(value,id=state.catalystId){if(!catalysts[id])throw new RangeError('未知催化系統');state.concentrations[id]=clampPercent(value);},snapshot(){return calculateSimulation({h2o2:state.h2o2,catalystId:state.catalystId,concentration:state.concentrations[state.catalystId]});}};
}
export function createComparison(){
 let baseline=null,rows=[],nextId=1;const dismissedRuns=new Set();
 const groups=()=>[...new Set(rows.map(row=>row.h2o2))];
 const selectRemaining=()=>{if(!rows.some(row=>row.h2o2===baseline))baseline=groups()[0]??null;};
 return {
  get baseline(){return baseline;},get groups(){return groups();},
  get rows(){return rows.filter(row=>row.h2o2===baseline).map(row=>({...row}));},
  selectBaseline(value){const h=Number(value);if(!groups().includes(h))throw new Error('尚無此濃度的比較資料');baseline=h;},
  syncHistory(historyRows){
   for(const run of historyRows){
    if(dismissedRuns.has(run.rowId))continue;
    const existing=rows.find(row=>row.sourceRunId===run.rowId);
    if(existing){existing.status=run.status;continue;}
    rows.push({...run,sourceRunId:run.rowId,rowId:nextId++});baseline=run.h2o2;
   }
  },
  add(result){if(baseline!==null&&result.h2o2!==baseline)throw new Error('請保持相同 H₂O₂ 濃度，或切換比較條件／清空比較。');if(rows.filter(row=>row.h2o2===baseline).length>=20)throw new Error('手動加入前請先移除部分比較項目。');baseline=result.h2o2;rows.push({...result,rowId:nextId++});},
  remove(id){const row=rows.find(row=>row.rowId===id);if(row?.sourceRunId!==undefined)dismissedRuns.add(row.sourceRunId);rows=rows.filter(row=>row.rowId!==id);selectRemaining();},
  clear(){for(const row of rows)if(row.sourceRunId!==undefined)dismissedRuns.add(row.sourceRunId);rows=[];baseline=null;}
 };
}
export function createHistory(){
 let rows=[],nextId=1;
 return {get rows(){return rows.map(row=>({...row}));},add(result,color){const rowId=nextId++;rows.push({...result,color,rowId,status:result.h2o2===0?'未噴發':'進行中'});return rowId;},update(rowId,status){const row=rows.find(row=>row.rowId===rowId);if(row)row.status=status;},clear(){rows=[];}};
}
