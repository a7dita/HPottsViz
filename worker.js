import { Simulation } from './lib/engine.js';
let sim,paused=false,reversing=false,reverseStep=0,lastFlush=0,pending=[],timer=null;
function flush(type='samples',extra={}){
 postMessage({type,samples:pending,q:sim?.q.slice(),...extra});pending=[];lastFlush=performance.now();
}
function tick(){
 if(paused||!sim)return;
 try{
  const until=performance.now()+45;
  while(performance.now()<until){
   if(reversing){
    sim.conservative();reverseStep++;
    if(reverseStep===sim.steps){flush('complete',{reversal:sim.reversalError(),state:sim.snapshot()});return;}
   }else{
    sim.step();
    if(sim.stepNumber%sim.p.save_every===0||sim.stepNumber===sim.steps)pending.push(sim.sample());
    if(sim.stepNumber===sim.steps){
     if(sim.model==='conservative'&&sim.p.reverse_check){
      flush('reversing',{state:sim.snapshot()});sim.reverseMomenta();reversing=true;
     }else{flush('complete',{state:sim.snapshot()});return;}
    }
   }
  }
  if(performance.now()-lastFlush>120)flush('samples',{step:sim.stepNumber,reverseStep});
  timer=setTimeout(tick,0);
 }catch(error){flush('error',{message:error.message});}
}
onmessage=({data})=>{
 if(data.type==='pause'){paused=true;clearTimeout(timer);postMessage({type:'paused'});return;}
 if(data.type==='resume'){paused=false;tick();return;}
 if(data.type==='start'){
  try{
   sim=new Simulation(data.model,data.config);pending=[sim.sample()];
   const edges=[];for(let i=0;i<250;i++)for(let e=sim.net.offsets[i];e<sim.net.offsets[i+1];e++)if(sim.net.neighbors[e]<i)edges.push([i,sim.net.neighbors[e]]);
   flush('ready',{steps:sim.steps,patterns:sim.net.patterns.map(p=>Array.from(p)),edges,initial:sim.snapshot()});tick();
  }catch(error){postMessage({type:'error',message:error.message});}
 }
};
