import test from 'node:test';
import assert from 'node:assert/strict';
import {catalysts,estimate} from '../src/chemistry.js';
test('all ten additives are available with distinct manganese compounds',()=>{
  assert.equal(Object.keys(catalysts).length,10);
  assert.equal(catalysts.mno2.formula,'MnO₂');assert.equal(catalysts.kmno4.formula,'KMnO₄');
});
test('zero concentration, zero amount and comparison groups do not erupt',()=>{
  for(const id of Object.keys(catalysts)){
    assert.equal(estimate(0,50,id).duration,0);assert.equal(estimate(30,0,id).duration,0);
  }
  for(const id of ['nacl','mgso4','kmno4','unknown'])assert.equal(estimate(30,50,id).volume,0);
});
test('catalytic rate changes time without inventing additional oxygen or mass',()=>{
  const reference=estimate(30,50,'ki');
  for(const [id,c] of Object.entries(catalysts))if(c.rate){
    const r=estimate(30,50,id);assert.equal(r.volume,reference.volume);assert.equal(r.weight,reference.weight);assert.ok(r.duration>0);
    assert.ok(estimate(30,100,id).duration<estimate(30,10,id).duration);
  }
  assert.ok(estimate(30,50,'fecl2').duration<estimate(30,50,'fecl3').duration);
  assert.ok(estimate(30,50,'cuso4').duration>estimate(30,50,'mno2').duration);
  assert.ok(estimate(30,50,'mno2').duration>estimate(30,50,'ferricSulfate').duration);
});
test('more peroxide increases oxygen estimate and values remain bounded',()=>{
  assert.ok(estimate(60,50).volume>estimate(30,50).volume);
  assert.deepEqual(estimate(200,200),estimate(100,100));
  assert.equal(estimate(NaN,50).volume,0);
});
