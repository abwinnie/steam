export const MODEL_NOTICE='示意模型，未經實驗校正；非實驗測量結果，不代表真實催化能力排名。';
const solution='溶質質量 ÷ 溶液總質量 × 100%（w/w）';
const definitions=[
 ['ki','碘化鉀','KI','solution',solution,1,'濃度只是此情境中的模型輸入，不代表真實反應一定隨濃度成比例增加。'],
 ['mno2','二氧化錳','MnO₂','dispersion','名義質量百分比：MnO₂ 固體質量 ÷ 分散系統總質量 × 100%',1,'不假定完全溶解；表面積、粒徑與分散狀態會影響實際結果。'],
 ['yeast','酵母菌','含 catalase 過氧化氫酶','biological','酵母菌懸浮液質量百分比：酵母菌質量 ÷ 懸浮液總質量 × 100%',1,'酵母菌不是純化合物；酵母菌質量不等於 catalase 含量。酵素活性與溫度、pH、菌體狀態有關。'],
 ['fecl2','氯化亞鐵','FeCl₂','metal-salt',solution,1,'Fe²⁺ 系統；氧化還原、pH、溶解度與反應條件可能改變效果。未設定普遍排名。'],
 ['fecl3','氯化鐵','FeCl₃','metal-salt',solution,1,'Fe³⁺ 系統，與 FeCl₂ 不同；缺乏定量校正資料，不由氧化態推定排名。'],
 ['feso4','硫酸亞鐵','FeSO₄','metal-salt',solution,1,'Fe²⁺ 系統，與硫酸鐵(III)不同；溶解度、pH 與氧化還原條件影響實際效果。'],
 ['ferricSulfate','硫酸鐵(III)','Fe₂(SO₄)₃','metal-salt',solution,1,'Fe³⁺ 系統；未根據化學式、分子量或相同 w/w% 推定催化能力。'],
 ['cuso4','硫酸銅','CuSO₄','metal-salt',solution,1,'涉及金屬離子與氧化還原條件；與鐵鹽共用未校正情境參數，不構成真實排名。'],
 ['mgso4','硫酸鎂','MgSO₄','comparison',solution,.03,'低影響比較組的示意設定；不宣稱在所有條件下都無影響。'],
 ['nacl','氯化鈉','NaCl','comparison',solution,.03,'低影響比較組的示意設定；不宣稱在所有條件下都無影響。']
];
export const catalysts=Object.fromEntries(definitions.map(([id,name,formula,type,concentrationBasis,modelCoefficient,notes])=>[id,Object.freeze({id,name,formula,type,concentrationBasis,modelCoefficient,evidenceLevel:'illustrative-unvalidated',notes})]));
export const clampPercent=value=>Math.min(100,Math.max(0,Number(value)||0));
const limit=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):1));
export function calculateCatalystEffect(catalystId,concentration,conditions={}){
 const catalyst=catalysts[catalystId];if(!catalyst)throw new RangeError('未知催化系統');
 const c=clampPercent(concentration)/100;
 // A slow background process remains at 0% catalyst. This is a teaching
 // scenario, not an assertion about uncatalysed peroxide kinetics.
 const background=.025;
 let response=1-Math.exp(-4*c);
 if(catalyst.type==='dispersion')response*=limit(conditions.surfaceFactor??1,0,2)*(.9-.25*c);
 if(catalyst.type==='biological')response*=limit(conditions.enzymeActivity??1,0,2)*Math.exp(-1.8*c*c);
 if(catalyst.type==='metal-salt')response*=limit(conditions.conditionFactor??1,0,2)*(.75-.2*c);
 return {catalystId,concentration:clampPercent(concentration),relativeRate:background+catalyst.modelCoefficient*response,background,evidenceLevel:catalyst.evidenceLevel,notice:MODEL_NOTICE};
}
export function calculateSimulation({h2o2=30,catalystId='ki',concentration=10,conditions={}}={}){
 const effect=calculateCatalystEffect(catalystId,concentration,conditions);
 const h=clampPercent(h2o2)/100;
 const relativeRate=h===0?0:effect.relativeRate*Math.sqrt(h);
 const strength=Math.min(1,relativeRate);
 const duration=h===0?0:Math.min(18,4+6/(.25+relativeRate));
 const gravity=28,launchSpeed=h===0?0:8+82*Math.sqrt(strength);
 const emissionRate=h===0?0:Math.min(4800/(duration*.65),12+500*strength);
 return {...effect,h2o2:h*100,relativeRate,strength,duration,gravity,launchSpeed,
  maxHeight:launchSpeed**2/(2*gravity),emissionRate,spread:.3+1.7*strength,
  progressExponent:.8+.7*strength,conversionFraction:h===0?0:1-Math.exp(-effect.relativeRate*3),
  // Deliberately virtual indices: no conversion from particle count to oxygen.
  volumeIndex:h===0?0:100*h*(1-Math.exp(-effect.relativeRate*3)),
  mass:h===0?0:100*h*(1-Math.exp(-effect.relativeRate*3)),notice:MODEL_NOTICE};
}
export const estimate=(h,concentration,catalystId='ki')=>calculateSimulation({h2o2:h,concentration,catalystId});
