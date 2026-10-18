import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './style.css';

const $ = id => document.getElementById(id);
const inputs = ['h2o2','ki','red','green','blue'];
const color = new THREE.Color();
let running = false, finished = false, elapsed = 0, reaction = null;
let renderer, scene, camera, controls, liquid, foam, flask;
const particles = [], maxParticles = 4800, pile = new Map();
const dummy = new THREE.Object3D();
let emission = 0, geometryTimer = 0;

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

// Fixed teaching model: 100 mL peroxide solution plus 10 mL catalyst/soap.
// KI changes reaction time, not the theoretical oxygen yield.
export function estimate(h,ki){
  if(h<=0||ki<=0)return {volume:0,weight:0,duration:0,strength:0};
  const peroxideMass=100*1.11*h/100;
  const oxygenLiters=(peroxideMass/34.0147/2)*24.0;
  return {volume:oxygenLiters*0.55+0.11,weight:111+10-peroxideMass/34.0147/2*31.998,
    duration:12-7*Math.sqrt(ki/100),strength:Math.sqrt(h/100)*(.45+.55*Math.sqrt(ki/100))};
}
function status(title,detail){$('status').replaceChildren(document.createTextNode(title));const small=document.createElement('span');small.textContent=detail;$('status').append(small);}
function showResults(fraction){
  $('volume').innerHTML=`${((reaction?.volume||0)*fraction).toFixed(2)} <em>L</em>`;
  $('weight').innerHTML=`${((reaction?.weight||0)*fraction).toFixed(1)} <em>g</em>`;
}
function liquidShape(height){
  const radius=y=>11.45-(y-1)*.29;
  const points=[new THREE.Vector2(0,.8),new THREE.Vector2(10.8,.8),new THREE.Vector2(11.45,1)];
  for(let y=2;y<height;y+=1)points.push(new THREE.Vector2(radius(y),y));
  points.push(new THREE.Vector2(radius(height),height),new THREE.Vector2(0,height));
  return new THREE.LatheGeometry(points,64);
}
function setLiquid(height){if(!liquid)return;liquid.geometry.dispose();liquid.geometry=liquidShape(Math.max(1.05,height));}
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
  // A real upright Erlenmeyer profile: flat base, curved shoulder, cylindrical neck,
  // lip and inner wall. Lathe axis is Y; this is not a cone primitive.
  const profile=[[0,.15],[10.8,.15],[12,.6],[12.5,1.3],[12.4,2.5],[6.0,23],[4.1,26],[3.6,27.5],[3.6,34.2],[4,34.7],[4,35.3],[3.25,35.3],[3.1,34.7],[3.1,27.4],[3.6,25.8],[5.5,22.7],[11.6,2.3],[11.6,1.2],[0,1.2]].map(p=>new THREE.Vector2(...p));
  flask=new THREE.Mesh(new THREE.LatheGeometry(profile,96),new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.9,roughness:.12,metalness:.05,clearcoat:1,clearcoatRoughness:.03,transmission:.95,ior:1.5,side:THREE.DoubleSide,depthWrite:false}));flask.castShadow=true;scene.add(flask);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(3.64,.32,12,80),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.12,transmission:.8,transparent:true,opacity:.65,ior:1.5}));rim.rotation.x=Math.PI/2;rim.position.y=35;scene.add(rim);
  liquid=new THREE.Mesh(liquidShape(11.5),new THREE.MeshPhysicalMaterial({color:0xff4197,roughness:.24,metalness:0,transmission:0,ior:1.34,clearcoat:1}));scene.add(liquid);
  const foamMaterial=new THREE.MeshStandardMaterial({color:0xff4197,roughness:.96,metalness:0,transparent:true,opacity:.93,bumpMap:foamTexture(),bumpScale:.24});
  foam=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),foamMaterial,maxParticles);foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);foam.count=0;foam.castShadow=true;foam.receiveShadow=true;foam.frustumCulled=false;scene.add(foam);
  const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(container);
  updateColor();
  let last=performance.now();renderer.setAnimationLoop(now=>{let remaining=Math.min((now-last)/1000,.5);last=now;while(remaining>0){const dt=Math.min(remaining,.025);tick(dt);remaining-=dt;}controls.update();renderer.render(scene,camera);});
  // Read-only diagnostics for automated browser checks.
  window.lab={get state(){return {running,finished,elapsed,particles:particles.length,settled:particles.filter(p=>p.settled).length,liquidHeight:liquid.geometry.boundingBox?.max.y??null,estimate:reaction};},estimate};
}
function resetCamera(){if(!camera)return;camera.position.set(155,145,190);controls.target.set(0,49,0);controls.update();}
$('camera-reset').addEventListener('click',resetCamera);
function reset(){running=false;finished=false;elapsed=0;reaction=null;emission=0;geometryTimer=0;particles.length=0;pile.clear();if(foam){foam.count=0;foam.material.color.copy(color);}setLiquid(11.5);showResults(0);status('準備就緒','等待你的下一場實驗');$('erupt').disabled=!renderer;$('erupt').innerHTML='開始噴發 <span>↗</span>';}
$('reset').addEventListener('click',reset);
$('erupt').addEventListener('click',()=>{
  if(!renderer||running)return;
  const h=Number($('h2o2').value),ki=Number($('ki').value);reset();reaction=estimate(h,ki);
  if(!h||!ki){status('沒有噴發','H₂O₂ 與 KI 濃度都需大於 0%');return;}
  foam.material.color.copy(color);running=true;status('反應進行中','氧氣釋放，泡沫正在綻放');$('erupt').disabled=true;$('erupt').textContent='實驗進行中…';
});
function emit(){
  if(particles.length>=maxParticles)return;
  const angle=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*1.65;
  const decay=Math.pow(Math.max(0,1-elapsed/reaction.duration),.45);
  particles.push({x:Math.cos(angle)*r,y:35+Math.random()*2.5,z:Math.sin(angle)*r,vx:0,vz:0,vy:(90+30*reaction.strength)*(.4+.6*decay),r:1.9+Math.random()*.7,age:0,settled:false,slide:0,shade:.82+Math.random()*.3});
}
function tick(dt){
  if(running){
    elapsed+=dt;geometryTimer+=dt;
    const progress=Math.min(1,elapsed/reaction.duration),decay=1-progress;
    if(progress<1){emission+=dt*(300+250*reaction.strength)*(.3+.7*decay);while(emission>=1){emit();emission--;}}
    if(geometryTimer>.09){setLiquid(1.1+10.4*(1-progress));liquid.geometry.computeBoundingBox();geometryTimer=0;}
    showResults(1-Math.pow(1-progress,1.5));
    if(progress>=1 && particles.every(p=>p.settled)){
      running=false;finished=true;showResults(1);status('實驗完成','泡沫已堆積，試試另一種配方');$('erupt').disabled=false;$('erupt').innerHTML='再次噴發 <span>↗</span>';
    }else if(progress>=1)status('緩緩沉降中','反應結束，泡沫正在堆積');
  }
  for(let i=0;i<particles.length;i++){
    const p=particles[i];p.age+=dt;
    if(!p.settled){
      p.vy-=28*dt;
      // Confine the fast central stream; expand and spread as pressure decays
      // near the apex. Soft outward pressure approximates foam repulsion.
      const spread=p.vy<30||p.y>140;
      const radial=Math.max(1,Math.hypot(p.x,p.z));
      if(spread){p.vx+=(p.x/radial*5+Math.sin(p.age*5+i)*3)*dt;p.vz+=(p.z/radial*5+Math.cos(p.age*5+i)*3)*dt;}
      else {p.vx+=(-p.x*1.8+Math.sin(i+p.age*7))*dt;p.vz+=(-p.z*1.8+Math.cos(i+p.age*7))*dt;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      // Resolve contact with the widening glass body and slide to its base.
      const radius=p.y<26?12.5-p.y*.32:3.8;
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
