const pages=await fetch('http://127.0.0.1:9222/json').then(r=>r.json());
const ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.result.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result.result.value;};
function assert(ok,msg){if(!ok)throw Error(msg);console.log('PASS',msg);}
await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:process.argv[2]||'http://127.0.0.1:5174/'});
for(let i=0;i<30;i++){await wait(500);if(await evaluate('!!window.lab'))break;}
assert(await evaluate('!!window.lab'),'Scene initializes');
const input=async(id,value)=>evaluate(`document.getElementById('${id}').value='${value}';document.getElementById('${id}').dispatchEvent(new Event('input'))`);
const click=async id=>evaluate(`document.getElementById('${id}').click()`);
const select=async(id,value)=>evaluate(`document.getElementById('${id}').value='${value}';document.getElementById('${id}').dispatchEvent(new Event('change'))`);
await click('erupt');assert(await evaluate("lab.state.history.length===1 && lab.state.comparison.length===1 && document.querySelectorAll('#comparison-rows tr').length===1"),'First simulation automatically populates comparison');await click('reset');
await select('catalyst','mno2');await click('erupt');assert(await evaluate("lab.state.comparison.length===2 && document.getElementById('comparison-rows').textContent.includes('MnO₂')"),'Second same-condition catalyst appears automatically');
await click('pause');assert(await evaluate("lab.state.comparison.length===2 && document.getElementById('comparison-rows').textContent.includes('已暫停')"),'State update does not duplicate rows');await click('reset');
await input('h2o2',60);await click('erupt');assert(await evaluate("lab.state.comparison.length===1 && lab.state.comparison[0].h2o2===60 && document.getElementById('comparison-group').options.length===2"),'Different peroxide is automatically grouped separately');
await select('comparison-group',30);assert(await evaluate('lab.state.comparison.length===2 && lab.state.comparison.every(row=>row.h2o2===30)'),'Previous group remains accessible');
await click('pause');assert(await evaluate("document.getElementById('comparison-group').value==='30' && lab.state.comparison.length===2"),'Pause preserves chosen group');
await evaluate("document.querySelector('#comparison-rows button').click()");await click('pause');assert(await evaluate('lab.state.comparison.length===1'),'Removed automatic row stays removed');
await click('clear-comparison');assert(await evaluate('lab.state.comparison.length===0 && lab.state.history.length===3'),'Clear comparison preserves simulation records');await click('pause');assert(await evaluate('lab.state.comparison.length===0'),'Status updates do not restore intentionally cleared data');
await click('reset');await click('erupt');assert(await evaluate('lab.state.comparison.length===1 && lab.state.comparison[0].h2o2===60'),'New simulation repopulates after explicit clear');await click('reset');
await click('clear-history');assert(await evaluate('lab.state.history.length===0 && lab.state.comparison.length===1'),'History clear retains comparison snapshots');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(1000);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Group selector and table fit mobile viewport');
assert(errors.length===0,'No browser exceptions');ws.close();
