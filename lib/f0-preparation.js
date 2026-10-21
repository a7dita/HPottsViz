// Energies use the same per-unit convention as Network.energy and the plots.
export const F0_WINDOW = 100;
export const F0_STABLE_STEPS = 100;
export const F0_RESCALE = 1.001;
export class F0Preparation {
 constructor(target,tolerance){
  this.target=target;this.tolerance=tolerance;this.values=new Float64Array(F0_WINDOW);
  this.count=0;this.index=0;this.sum=0;this.mean=null;this.stable=0;
  this.phase='preparing';this.releaseStep=null;this.releaseEnergy=null;this.rescaleCount=0;
 }
 observe(f0,step){
  if(!Number.isFinite(f0))throw Error('Non-finite F₀ during preparation. Reduce dt or change the target.');
  this.sum+=f0-this.values[this.index];this.values[this.index]=f0;
  this.index=(this.index+1)%F0_WINDOW;this.count=Math.min(F0_WINDOW,this.count+1);
  this.mean=this.count===F0_WINDOW?this.sum/F0_WINDOW:null;
  if(this.phase==='released'||this.mean===null)return 1;
  const difference=this.mean-this.target;
  if(Math.abs(difference)<=this.tolerance){
   this.stable++;
   if(this.stable===F0_STABLE_STEPS){this.phase='released';this.releaseStep=step;}
   return 1;
  }
  this.stable=0;this.rescaleCount++;
  return difference<0?F0_RESCALE:1/F0_RESCALE;
 }
 diagnostics(){return {preparation_phase:this.phase,f0_mean_100:this.mean,f0_window_count:this.count,f0_target:this.target,f0_tolerance:this.tolerance,f0_stable_steps:this.stable,rescale_count:this.rescaleCount,release_step:this.releaseStep,release_energy:this.releaseEnergy};}
}
