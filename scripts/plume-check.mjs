import fs from 'node:fs';
const artifactDir=process.env.BROWSER_ARTIFACT_DIR||'/tmp/sakura-lab-check';fs.mkdirSync(artifactDir,{recursive:true});
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
await click('erupt');
assert(await evaluate('lab.state.estimate.h2o2===30 && lab.state.estimate.concentration===10 && lab.state.estimate.maxHeight>=105'),'Default configuration restores high model plume');
let deadline=Date.now()+90000;while(Date.now()<deadline && !(await evaluate('lab.state.peakVisualHeight>=100 && lab.state.particles>=600')))await wait(1000);
assert(await evaluate('lab.state.peakVisualHeight>=100 && lab.state.particles>=600'),'Actual particle stream rises over 100 scene units with dense foam');
let shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${artifactDir}/restored-plume.png`,Buffer.from(shot.result.data,'base64'));
await click('pause');const before=await evaluate('lab.state.elapsed');await wait(1000);assert(await evaluate('lab.state.paused && lab.state.elapsed==='+before),'Pause retained');await click('pause');
deadline=Date.now()+120000;while(Date.now()<deadline && !(await evaluate('lab.state.finished')))await wait(1000);
console.log('Completed default:',await evaluate('JSON.stringify({particles:lab.state.particles,peakVisualHeight:lab.state.peakVisualHeight,settled:lab.state.settled})'));
assert(await evaluate("lab.state.finished && lab.state.particles>=3500 && lab.state.particles<=4800 && lab.state.settled===lab.state.particles && lab.state.history[0].status==='已完成'"),'Thousands of foam particles settle and history completes');
await click('reset');assert(await evaluate('lab.state.particles===0 && lab.state.peakVisualHeight===0 && lab.state.history.length===1'),'Reset retains history and clears peak');
await input('h2o2',0);await click('erupt');assert(await evaluate('!lab.state.running && lab.state.particles===0'),'Zero peroxide remains disabled');
await input('h2o2',30);await input('catalyst-concentration',0);await click('erupt');assert(await evaluate('lab.state.estimate.maxHeight<40 && lab.state.estimate.visualParticleBudget<1800 && lab.state.running'),'Zero catalyst remains a weak background process');await click('reset');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(1000);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile layout retained');
assert(errors.length===0,'No browser exceptions');ws.close();
