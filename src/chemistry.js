// Rate factors are game-design parameters, not measured chemical constants.
export const catalysts = {
  ki:{name:'碘化鉀',formula:'KI',rate:1,note:'預設催化劑。濃度影響示意速度，不改變 H₂O₂ 的理論氧氣產量。'},
  mno2:{name:'二氧化錳',formula:'MnO₂',rate:1.1,note:'固體催化劑；此處添加量為相對值，未模擬粒徑或表面積。MnO₂ 不是過錳酸鉀。'},
  kmno4:{name:'過錳酸鉀',formula:'KMnO₄',rate:0,unsupported:true,note:'KMnO₄ 與 MnO₂ 不同，可能作為氧化還原反應物而被消耗。本遊戲尚未建立此反應模型，不產生噴發預測。'},
  yeast:{name:'酵母菌',formula:'過氧化氫酶',rate:.65,note:'你的配方備註：10 g 酵母＋11 mL 熱水。溫度可能改變酵素活性，過熱可能失活；此處未模擬水溫或換算此配方。'},
  fecl3:{name:'氯化鐵',formula:'FeCl₃',rate:.8,note:'氯化鐵含 Fe³⁺。速度僅作遊戲示意，不能視為與氯化亞鐵的通用實驗排名。'},
  fecl2:{name:'氯化亞鐵',formula:'FeCl₂',rate:1.05,note:'氯化亞鐵含 Fe²⁺。依你的比較需求呈現較快的示意反應；實際表現與酸鹼度等條件有關。'},
  nacl:{name:'氯化鈉',formula:'NaCl',rate:0,note:'作為比較組：在本模型中不設定明顯的 H₂O₂ 分解催化效果，因此不噴發。'},
  mgso4:{name:'硫酸鎂',formula:'MgSO₄',rate:0,note:'作為比較組：在本模型中不設定明顯的 H₂O₂ 分解催化效果，因此不噴發。'},
  cuso4:{name:'硫酸銅',formula:'CuSO₄',rate:.35,note:'使用較慢的示意反應。此數值不是實測速率，實際效果受酸鹼度與配方影響。'},
  ferricSulfate:{name:'硫酸鐵',formula:'Fe₂(SO₄)₃',rate:1.35,note:'依你的比較需求使用較快的示意反應；排序不是適用所有濃度與實驗條件的化學定律。'}
};

export function estimate(h,amount,catalystId='ki') {
  const catalyst=catalysts[catalystId];
  h=Math.max(0,Math.min(100,Number(h)||0));
  amount=Math.max(0,Math.min(100,Number(amount)||0));
  if(!catalyst||h<=0||amount<=0||catalyst.rate===0)return {volume:0,weight:0,duration:0,strength:0,catalystId};
  const peroxideMass=100*1.11*h/100;
  const oxygenLiters=(peroxideMass/34.0147/2)*24;
  const activity=Math.min(1.35,Math.sqrt(amount/100)*catalyst.rate);
  return {volume:oxygenLiters*.55+.11,weight:121-peroxideMass/34.0147/2*31.998,
    duration:Math.max(3.5,(12-7*Math.sqrt(amount/100))/catalyst.rate),
    strength:Math.min(1,Math.sqrt(h/100)*(.45+.55*activity)),catalystId};
}
