import test from 'node:test';
import assert from 'node:assert/strict';
import {catalysts,calculateCatalystEffect,calculateSimulation} from '../src/chemistry.js';
import {createSettings,createComparison} from '../src/settings.js';
test('exact ten systems with distinct iron oxidation states and no permanganate',()=>{
 assert.deepEqual(Object.keys(catalysts),['ki','mno2','yeast','fecl2','fecl3','feso4','ferricSulfate','cuso4','mgso4','nacl']);
 assert.equal(catalysts.feso4.formula,'FeSO₄');assert.equal(catalysts.ferricSulfate.formula,'Fe₂(SO₄)₃');
 for(const c of Object.values(catalysts))for(const key of ['id','name','formula','type','concentrationBasis','modelCoefficient','evidenceLevel','notes'])assert.ok(c[key]!==undefined);
 assert.match(catalysts.mno2.concentrationBasis,/名義/);assert.match(catalysts.yeast.concentrationBasis,/菌質量/);
});
test('zero peroxide never erupts; zero catalyst retains explicit background',()=>{
 for(const id of Object.keys(catalysts)){
  const zero=calculateSimulation({h2o2:0,catalystId:id,concentration:100});
  assert.equal(zero.emissionRate,0);assert.equal(zero.maxHeight,0);assert.equal(zero.volumeIndex,0);assert.equal(zero.mass,0);
  assert.ok(calculateSimulation({h2o2:30,catalystId:id,concentration:0}).relativeRate>0);
 }
});
test('nonlinear systems and conditions do not encode previous unsupported salt rankings',()=>{
 assert.ok(calculateCatalystEffect('yeast',40).relativeRate>calculateCatalystEffect('yeast',100).relativeRate);
 assert.ok(calculateCatalystEffect('mno2',30,{surfaceFactor:2}).relativeRate>calculateCatalystEffect('mno2',30,{surfaceFactor:.5}).relativeRate);
 assert.equal(calculateCatalystEffect('fecl2',30).relativeRate,calculateCatalystEffect('fecl3',30).relativeRate);
 assert.equal(calculateCatalystEffect('feso4',30).relativeRate,calculateCatalystEffect('ferricSulfate',30).relativeRate);
 assert.ok(calculateCatalystEffect('nacl',50).relativeRate>calculateCatalystEffect('nacl',0).relativeRate);
});
test('all animation parameters share a bounded model and ballistic height',()=>{
 for(const catalystId of Object.keys(catalysts))for(const concentration of [0,10,50,100]){
  const r=calculateSimulation({catalystId,concentration});
  for(const key of ['relativeRate','duration','launchSpeed','maxHeight','emissionRate','spread','progressExponent','volumeIndex','mass'])assert.ok(Number.isFinite(r[key])&&r[key]>=0,key);
  assert.equal(r.maxHeight,r.launchSpeed**2/(2*r.gravity));assert.match(r.notice,/未經實驗校正/);
 }
 assert.deepEqual(calculateSimulation({h2o2:200,concentration:200}),calculateSimulation({h2o2:100,concentration:100}));
 assert.throws(()=>calculateCatalystEffect('kmno4',10),RangeError);
});
test('KI controls share state while other concentrations are independent',()=>{
 const model=createSettings();model.setConcentration(25,'ki');assert.equal(model.snapshot().concentration,25);
 model.select('mno2');model.setConcentration(70);model.setConcentration(40,'ki');assert.equal(model.snapshot().concentration,70);
 model.select('ki');assert.equal(model.snapshot().concentration,40);
 model.setConcentration(-5);assert.equal(model.snapshot().concentration,0);model.setConcentration(125);assert.equal(model.snapshot().concentration,100);
});
test('comparison freezes model snapshots and rejects mixed peroxide conditions',()=>{
 const settings=createSettings(),list=createComparison();list.add(settings.snapshot());settings.select('feso4');settings.setConcentration(45);list.add(settings.snapshot());
 assert.equal(list.rows.length,2);assert.equal(list.rows[0].catalystId,'ki');assert.equal(list.rows[1].concentration,45);
 settings.setH2o2(60);assert.throws(()=>list.add(settings.snapshot()),/相同/);assert.equal(list.rows.length,2);
 const copy=list.rows;copy[0].mass=-100;assert.ok(list.rows[0].mass>=0);
 list.remove(list.rows[0].rowId);assert.equal(list.baseline,30);list.clear();assert.equal(list.baseline,null);list.add(settings.snapshot());assert.equal(list.baseline,60);
});

test('automatic history retains every snapshot independently of live settings',async()=>{
 const {createHistory}=await import('../src/settings.js');const history=createHistory(),settings=createSettings();
 const id=history.add(settings.snapshot(),'#FF4197');settings.setH2o2(60);settings.select('yeast');
 history.update(id,'已暫停');history.update(id,'進行中');history.update(id,'已重設（未完成）');
 const next=history.add(settings.snapshot(),'#0080FF');history.update(next,'已完成');
 assert.equal(history.rows.length,2);assert.equal(history.rows[0].h2o2,30);assert.equal(history.rows[0].catalystId,'ki');
 assert.equal(history.rows[0].color,'#FF4197');assert.equal(history.rows[0].status,'已重設（未完成）');assert.equal(history.rows[1].status,'已完成');
 const copy=history.rows;copy[0].status='wrong';assert.notEqual(history.rows[0].status,'wrong');
 settings.setH2o2(0);history.add(settings.snapshot(),'#000000');assert.equal(history.rows[2].status,'未噴發');assert.equal(history.rows[2].mass,0);
 history.clear();assert.equal(history.rows.length,0);
});

test('default 30% peroxide restores dense high eruption without changing model indicators',()=>{
 const r=calculateSimulation();
 assert.ok(r.maxHeight>=3*35,'default column rises at least three cylinder heights above its mouth');
 assert.ok(r.emissionRate>=280,'default stream stays dense');
 assert.equal(r.visualParticleBudget,3600);
 assert.ok(Math.abs(r.emissionRate*r.duration*.65-r.visualParticleBudget)<1e-9);
 assert.ok(Math.abs(r.relativeRate-.1942662114811742)<1e-12,'relative kinetic indicator is unchanged');
 assert.ok(Math.abs(r.volumeIndex-19.648229998071947)<1e-10,'volume index is unchanged');
 assert.equal(r.mass,r.volumeIndex);
});
test('visual gain preserves zero/low-effect distinctions and bounded particle cost',()=>{
 const normal=calculateSimulation(),background=calculateSimulation({concentration:0});
 assert.ok(background.maxHeight<normal.maxHeight/3);assert.ok(background.visualParticleBudget<normal.visualParticleBudget/2);
 for(const catalystId of Object.keys(catalysts))for(const h2o2 of [0,.1,30,100])for(const concentration of [0,10,100]){
  const r=calculateSimulation({catalystId,h2o2,concentration});
  assert.ok(r.visualParticleBudget<=4800);assert.ok(r.visualParticleBudget>=0);
  if(h2o2===0){assert.equal(r.visualParticleBudget,0);assert.equal(r.emissionRate,0);assert.equal(r.maxHeight,0);}
 }
 assert.ok(calculateSimulation({h2o2:100,concentration:100}).visualParticleBudget>=normal.visualParticleBudget);
});

test('history automatically populates comparison groups without duplicates or mixed conditions',async()=>{
 const {createHistory}=await import('../src/settings.js');const history=createHistory(),list=createComparison(),settings=createSettings();
 const first=history.add(settings.snapshot(),'#FF4197');settings.select('mno2');history.add(settings.snapshot(),'#FF4197');
 list.syncHistory(history.rows);assert.equal(list.rows.length,2);assert.equal(list.baseline,30);
 history.update(first,'已完成');list.syncHistory(history.rows);assert.equal(list.rows.length,2);assert.equal(list.rows[0].status,'已完成');
 settings.setH2o2(60);history.add(settings.snapshot(),'#FF4197');list.syncHistory(history.rows);
 assert.deepEqual(list.groups,[30,60]);assert.equal(list.baseline,60);assert.equal(list.rows.length,1);
 list.selectBaseline(30);list.syncHistory(history.rows);assert.equal(list.rows.length,2);assert.ok(list.rows.every(row=>row.h2o2===30));
 const removeId=list.rows[0].rowId;list.remove(removeId);list.syncHistory(history.rows);assert.equal(list.rows.length,1);
 list.clear();list.syncHistory(history.rows);assert.equal(list.rows.length,0);assert.deepEqual(list.groups,[]);
 history.add(settings.snapshot(),'#0080FF');list.syncHistory(history.rows);assert.equal(list.rows.length,1);assert.equal(list.baseline,60);
 history.clear();list.syncHistory(history.rows);assert.equal(list.rows.length,1,'clearing history does not destroy saved comparison snapshots');
});
