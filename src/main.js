import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './style.css';
import { catalysts, estimate, MODEL_NOTICE } from './chemistry.js';
import { createSettings, createComparison, createHistory } from './settings.js';

const $ = id => document.getElementById(id);
const inputs = ['red','green','blue'];
const settings=createSettings(), comparison=createComparison();
const history=createHistory();
let activeRun=null;
let paused=false;
const color = new THREE.Color();
let running = false, finished = false, elapsed = 0, reaction = null;
let renderer, scene, camera, controls, liquid, foam, cylinder;
const liquidBase=1.8, initialLiquidHeight=31;
const particles = [], maxParticles = 4800, pile = new Map();
const dummy = new THREE.Object3D();
let emission = 0, geometryTimer = 0, peakVisualHeight = 0;

function clampInput(id) {
  const el=$(id), max=Number(el.max);
  el.value=String(Math.min(max, Math.max(0, Number(el.value)||0)));
  if($(id+'-range'))$(id+'-range').value=el.value;
}
function updateColor() {
  const values=['red','green','blue'].map(id=>Number($(id).value));
  const hex='#'+values.map(v=>v.toString(16).padStart(2,'0')).join('');
  color.set(hex);
  $('swatch').style.background=hex;
  $('hex').textContent=hex.toUpperCase();
  for(const id of ['red','green','blue'])$(id+'-value').textContent=$(id).value;
  if(liquid)liquid.material.color.copy(color);
  if(foam && !reaction)foam.material.color.copy(color);
}
for(const id of inputs){
  $(id).addEventListener('input',()=>{clampInput(id);updateColor();});
  const range=$(id+'-range');
  if(range)range.addEventListener('input',()=>{$(id).value=range.value;});
}
$('pink').addEventListener('click',()=>{['red','green','blue'].forEach((id,i)=>$(id).value=[255,65,151][i]);updateColor();});
for(const [id,catalyst] of Object.entries(catalysts)){
  const option=document.createElement('option');option.value=id;option.textContent=`${catalyst.name} · ${catalyst.formula}`;$('catalyst').append(option);
}
function refreshSettings(){
  const {state}=settings, catalyst=catalysts[state.catalystId], result=settings.snapshot();
  $('catalyst').value=state.catalystId;
  $('catalyst-note').textContent=`${catalyst.formula} · ${catalyst.notes}`;
  $('concentration-basis').textContent=catalyst.concentrationBasis;
  for(const suffix of ['', '-range']){
    $('h2o2'+suffix).value=state.h2o2;
    $('ki'+suffix).value=state.concentrations.ki;
    $('catalyst-concentration'+suffix).value=state.concentrations[state.catalystId];
  }
  $('effect-summary').textContent=`相對速率 ${Number(result.relativeRate.toPrecision(2))} · 最高高度 ${Math.round(result.maxHeight)} 場景單位 · 體積指標 ${result.volumeIndex.toFixed(1)}。${running?'設定用於下一次實驗；目前實驗參數已鎖定。':''}`;
}
for(const id of ['h2o2','ki','catalyst-concentration'])for(const suffix of ['', '-range']){
 $(id+suffix).addEventListener('input',event=>{
  if(id==='h2o2')settings.setH2o2(event.target.value);
  else settings.setConcentration(event.target.value,id==='ki'?'ki':settings.state.catalystId);
  refreshSettings();
 });
}
$('catalyst').addEventListener('change',()=>{settings.select($('catalyst').value);refreshSettings();});
refreshSettings();
function renderComparison(){
 const tbody=$('comparison-rows');tbody.replaceChildren();
 for(const row of comparison.rows){
  const catalyst=catalysts[row.catalystId],tr=document.createElement('tr');
  for(const text of [`${catalyst.name} · ${catalyst.formula}`,row.h2o2,row.concentration,Number(row.relativeRate.toPrecision(2)),Math.round(row.maxHeight),row.volumeIndex.toFixed(1),row.mass.toFixed(1),`${MODEL_NOTICE} ${catalyst.concentrationBasis} ${catalyst.notes}`]){
   const td=document.createElement('td');td.textContent=text;tr.append(td);
  }
  const td=document.createElement('td'),button=document.createElement('button');button.textContent='移除';button.setAttribute('aria-label',`移除 ${catalyst.name} 比較項目`);button.addEventListener('click',()=>{comparison.remove(row.rowId);renderComparison();});td.append(button);tr.append(td);tbody.append(tr);
 }
 $('comparison-message').textContent=comparison.rows.length?`已保存 ${comparison.rows.length} 筆 · 固定 H₂O₂ ${comparison.baseline}% · 僅本次頁面工作階段保存`:'尚未加入設定。選擇催化系統後按「加入催化劑比較」。';
}
$('add-comparison').addEventListener('click',()=>{try{comparison.add(settings.snapshot());renderComparison();}catch(error){$('comparison-message').textContent=error.message;}});
$('clear-comparison').addEventListener('click',()=>{comparison.clear();renderComparison();});
function renderHistory(){
 const tbody=$('history-rows');tbody.replaceChildren();
 for(const row of history.rows){
  const tr=document.createElement('tr'),catalyst=catalysts[row.catalystId];
  for(const value of [row.rowId,row.status,`${catalyst.name} · ${catalyst.formula}`,row.h2o2,row.concentration,row.color,Number(row.relativeRate.toPrecision(2)),Math.round(row.maxHeight),row.volumeIndex.toFixed(1),row.mass.toFixed(1)]){
   const td=document.createElement('td');td.textContent=value;tr.append(td);
  }
  tbody.append(tr);
 }
 $('history-message').textContent=history.rows.length?`本次頁面已記錄 ${history.rows.length} 次模擬；重新調配不會刪除紀錄，重新整理頁面則會清除。`:'尚未開始模擬。每次按「開始噴發」會自動新增一筆，無須手動加入。';
 $('clear-history').disabled=running;
}
function updateHistory(state){if(activeRun!==null)history.update(activeRun,state);renderHistory();}
$('clear-history').addEventListener('click',()=>{if(running)return;history.clear();activeRun=null;renderHistory();});
function status(title,detail){$('status').replaceChildren(document.createTextNode(title));const small=document.createElement('span');small.textContent=detail;$('status').append(small);}
function showResults(fraction){
  $('volume').innerHTML=`${((reaction?.volumeIndex||0)*fraction).toFixed(1)} <em>指數</em>`;
  $('weight').innerHTML=`${((reaction?.mass||0)*fraction).toFixed(1)} <em>虛擬 g</em>`;
}
function liquidShape(height){
  const points=[[0,liquidBase],[4.7,liquidBase],[4.7,height],[0,height]].map(p=>new THREE.Vector2(...p));
  return new THREE.LatheGeometry(points,64);
}
function setLiquid(height){if(!liquid)return;liquid.geometry.dispose();liquid.geometry=liquidShape(Math.max(liquidBase+.05,height));}
function foamTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#b9b9b9';ctx.fillRect(0,0,128,128);
  let seed=47;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<900;i++){const x=rand()*128,y=rand()*128,r=.5+rand()*2.5;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=`rgb(${70+rand()*80},${70+rand()*80},${70+rand()*80})`;ctx.fill();ctx.strokeStyle='#e7e7e7';ctx.lineWidth=.5;ctx.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}
function init(){
  const container=$('scene');
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  container.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0xf7ecef,300,660);
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  camera=new THREE.PerspectiveCamera(39,1,1,1200);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=100;controls.maxDistance=450;controls.maxPolarAngle=Math.PI/2-.03;controls.minPolarAngle=.15;controls.target.set(0,49,0);
  resetCamera();
  scene.add(new THREE.HemisphereLight(0xfff5fa,0xb6a9b7,2.5));
  const sun=new THREE.DirectionalLight(0xfff4ec,4);sun.position.set(-75,170,90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-130;sun.shadow.camera.right=130;sun.shadow.camera.top=140;sun.shadow.camera.bottom=-130;sun.shadow.camera.far=450;sun.shadow.normalBias=.15;sun.shadow.bias=-.0001;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xffc3e0,1.3);fill.position.set(70,60,-80);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshStandardMaterial({color:0xd8d5d6,roughness:.72,metalness:.02}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.15;scene.add(ground);
  // Hollow, straight-sided 100 mL graduated cylinder with a broad stable foot.
  const profile=[[0,.2],[8,.2],[8,.9],[7.7,1.3],[5.25,1.3],[5.25,34.6],[5.65,35],[5.65,35.4],[4.8,35.4],[4.8,1.8],[0,1.8]].map(p=>new THREE.Vector2(...p));
  cylinder=new THREE.Mesh(new THREE.LatheGeometry(profile,96),new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.9,roughness:.12,metalness:.05,clearcoat:1,clearcoatRoughness:.03,transmission:.95,ior:1.5,side:THREE.DoubleSide,depthWrite:false}));cylinder.castShadow=true;scene.add(cylinder);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(5.2,.3,12,80),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.12,transmission:.8,transparent:true,opacity:.65,ior:1.5}));rim.rotation.x=Math.PI/2;rim.position.y=35.2;scene.add(rim);
  const marks=new THREE.Group();marks.name='100 mL graduations';scene.add(marks);
  const ink=new THREE.LineBasicMaterial({color:0x765669,transparent:true,opacity:.85});
  for(let ml=5;ml<=100;ml+=5){
    const y=liquidBase+(initialLiquidHeight-liquidBase)*ml/100;
    const points=[];for(let j=0;j<=16;j++){const angle=.1+j/16*(ml%10===0?.8:.45);points.push(new THREE.Vector3(Math.sin(angle)*5.3,y,Math.cos(angle)*5.3));}
    marks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),ink));
    if(ml%10===0){
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#654457';ctx.font='600 54px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ml===100?'100 mL':String(ml),128,48);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));label.position.set(5.8,y,4);label.scale.set(ml===100?6:3.5,1.7,1);marks.add(label);
    }
  }
  liquid=new THREE.Mesh(liquidShape(initialLiquidHeight),new THREE.MeshPhysicalMaterial({color:0xff4197,roughness:.24,metalness:0,transmission:0,ior:1.34,clearcoat:1}));scene.add(liquid);
  const foamMaterial=new THREE.MeshStandardMaterial({color:0xff4197,roughness:.96,metalness:0,transparent:true,opacity:.93,bumpMap:foamTexture(),bumpScale:.24});
  foam=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),foamMaterial,maxParticles);foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);foam.count=0;foam.castShadow=true;foam.receiveShadow=true;foam.frustumCulled=false;scene.add(foam);
  const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(container);
  updateColor();
  let last=performance.now();renderer.setAnimationLoop(now=>{let remaining=Math.min((now-last)/1000,.5);last=now;while(remaining>0){const dt=Math.min(remaining,.025);if(!paused)tick(dt);remaining-=dt;}controls.update();renderer.render(scene,camera);});
  // Read-only diagnostics for automated browser checks.
  window.lab={get state(){return {running,paused,finished,elapsed,particles:particles.length,peakVisualHeight,settled:particles.filter(p=>p.settled).length,liquidHeight:liquid.geometry.boundingBox?.max.y??null,estimate:reaction,settings:structuredClone(settings.state),comparison:comparison.rows,history:history.rows};},estimate};
}
function resetCamera(){if(!camera)return;if(running||finished){camera.position.set(190,260,220);controls.target.set(0,70,0);}else{camera.position.set(85,150,100);controls.target.set(0,18,0);}controls.update();}
$('camera-reset').addEventListener('click',resetCamera);
function reset(){if(running)updateHistory('已重設（未完成）');activeRun=null;paused=false;$('pause').disabled=true;$('pause').textContent='暫停';running=false;finished=false;elapsed=0;reaction=null;emission=0;geometryTimer=0;peakVisualHeight=0;particles.length=0;pile.clear();if(foam){foam.count=0;foam.material.color.copy(color);}setLiquid(initialLiquidHeight);resetCamera();showResults(0);status('準備就緒','等待你的下一場實驗');$('erupt').disabled=!renderer;$('erupt').innerHTML='開始噴發 <span>↗</span>';refreshSettings();renderHistory();}
$('reset').addEventListener('click',reset);
$('pause').addEventListener('click',()=>{if(!running)return;paused=!paused;updateHistory(paused?'已暫停':'進行中');$('pause').textContent=paused?'繼續':'暫停';status(paused?'已暫停':'反應進行中',paused?'泡沫與液面已暫停，可繼續實驗':'呈現目前已鎖定的模擬條件');});
$('erupt').addEventListener('click',()=>{
  if(!renderer||running)return;
  reset();reaction=settings.snapshot();activeRun=history.add(reaction,$('hex').textContent);renderHistory();const catalyst=catalysts[reaction.catalystId];
  if(!reaction.h2o2){activeRun=null;status('沒有噴發','H₂O₂ 濃度為 0%，不產生分解驅動的泡沫');return;}
  foam.material.color.copy(color);running=true;resetCamera();status('反應進行中',`${catalyst.name} · 非實驗測量結果`);$('erupt').disabled=true;$('erupt').textContent='實驗進行中…';$('pause').disabled=false;refreshSettings();renderHistory();
});
function emit(){
  if(particles.length>=maxParticles)return;
  const angle=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*1.65;
  const decay=Math.pow(Math.max(0,1-elapsed/reaction.duration),.45);
  particles.push({x:Math.cos(angle)*r,y:35+Math.random()*2.5,z:Math.sin(angle)*r,vx:0,vz:0,vy:reaction.launchSpeed*(.4+.6*decay),r:1.9+Math.random()*.7,age:0,settled:false,slide:0,shade:.82+Math.random()*.3});
}
function tick(dt){
  if(running){
    elapsed+=dt;geometryTimer+=dt;
    const progress=Math.min(1,elapsed/reaction.duration),decay=1-progress;
    if(progress<1){emission+=dt*reaction.emissionRate*(.3+.7*decay);while(emission>=1){emit();emission--;}}
    if(geometryTimer>.09){setLiquid(initialLiquidHeight-(initialLiquidHeight-liquidBase-.1)*reaction.conversionFraction*(1-Math.pow(1-progress,reaction.progressExponent)));liquid.geometry.computeBoundingBox();geometryTimer=0;}
    showResults(1-Math.pow(1-progress,reaction.progressExponent));
    if(progress>=1 && particles.every(p=>p.settled)){
      running=false;finished=true;updateHistory('已完成');activeRun=null;$('pause').disabled=true;showResults(1);status('實驗完成','泡沫已堆積，試試另一種配方');$('erupt').disabled=false;$('erupt').innerHTML='再次噴發 <span>↗</span>';refreshSettings();
    }else if(progress>=1)status('緩緩沉降中','反應結束，泡沫正在堆積');
  }
  for(let i=0;i<particles.length;i++){
    const p=particles[i];p.age+=dt;
    if(!p.settled){
      p.vy-=reaction.gravity*dt;
      // Confine the fast central stream; expand and spread as pressure decays
      // near the apex. Soft outward pressure approximates foam repulsion.
      const spread=p.vy<30||p.y>35+reaction.maxHeight*.85;
      const radial=Math.max(1,Math.hypot(p.x,p.z));
      if(spread){p.vx+=(p.x/radial*5+Math.sin(p.age*5+i)*3)*reaction.spread*dt;p.vz+=(p.z/radial*5+Math.cos(p.age*5+i)*3)*reaction.spread*dt;}
      else {p.vx+=(-p.x*1.8+Math.sin(i+p.age*7))*dt;p.vz+=(-p.z*1.8+Math.cos(i+p.age*7))*dt;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      peakVisualHeight=Math.max(peakVisualHeight,p.y-35);
      // Resolve contact with the straight cylinder wall and its broad foot.
      const radius=p.y<1.4?8:5.25;
      const dist=Math.hypot(p.x,p.z);
      if(p.vy<0&&p.y<35&&p.y>1&&dist<radius+p.r){
        const a=dist>.1?Math.atan2(p.z,p.x):i*2.4;
        p.x=Math.cos(a)*(radius+p.r);p.z=Math.sin(a)*(radius+p.r);p.vx+=Math.cos(a)*12*dt;p.vz+=Math.sin(a)*12*dt;p.vy*=Math.exp(-3*dt);
      }
      const key=`${Math.round(p.x/4)},${Math.round(p.z/4)}`;
      const ground=pile.get(key)||0;
      if(p.vy<0&&p.y<=ground+p.r*.55){p.y=ground+p.r*.55;p.settled=true;p.slide=.8;p.vx*=.12;p.vz*=.12;pile.set(key,Math.min(20,ground+p.r*.24));}
    }else if(p.slide>0){p.slide-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.vx*=Math.exp(-7*dt);p.vz*=Math.exp(-7*dt);}
    const grow=.8+.2*Math.min(1,p.age*5),r=p.r*grow;
    dummy.position.set(p.x,p.y,p.z);dummy.scale.set(r*(p.settled?1.3:1),r*(p.settled?.55:1.08),r*(p.settled?1.3:1));dummy.rotation.set(i*.17,p.age*.1,0);dummy.updateMatrix();foam.setMatrixAt(i,dummy.matrix);
    // Small tonal variations keep adjoining foam bubbles visually continuous.
    if(p.age<dt*1.5)foam.setColorAt(i,new THREE.Color(p.shade,p.shade,p.shade));
  }
  if(foam){foam.count=particles.length;foam.instanceMatrix.needsUpdate=true;if(foam.instanceColor)foam.instanceColor.needsUpdate=true;}
}
try{init();}catch(error){console.error(error);$('webgl-error').hidden=false;$('erupt').disabled=true;status('3D 顯示不可用','請使用支援 WebGL 的瀏覽器');}
