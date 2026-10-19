import {catalysts,clampPercent,calculateSimulation} from './chemistry.js';
export function createSettings(){
 const state={h2o2:30,catalystId:'ki',concentrations:Object.fromEntries(Object.keys(catalysts).map(id=>[id,10]))};
 return {state,setH2o2(value){state.h2o2=clampPercent(value);},select(id){if(!catalysts[id])throw new RangeError('未知催化系統');state.catalystId=id;},setConcentration(value,id=state.catalystId){if(!catalysts[id])throw new RangeError('未知催化系統');state.concentrations[id]=clampPercent(value);},snapshot(){return calculateSimulation({h2o2:state.h2o2,catalystId:state.catalystId,concentration:state.concentrations[state.catalystId]});}};
}
export function createComparison(){
 let baseline=null,rows=[],nextId=1;
 return {get baseline(){return baseline;},get rows(){return rows.map(row=>({...row}));},add(result){if(baseline!==null&&result.h2o2!==baseline)throw new Error('請保持相同 H₂O₂ 濃度，或清空清單後建立新的比較。');if(rows.length>=20)throw new Error('比較清單最多保存 20 筆，請先移除部分項目。');baseline=result.h2o2;rows.push({...result,rowId:nextId++});},remove(id){rows=rows.filter(row=>row.rowId!==id);if(!rows.length)baseline=null;},clear(){rows=[];baseline=null;}};
}
