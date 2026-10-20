import { N, MODELS, validate } from './models.js';
export class RNG {
 constructor(seed){this.state=seed>>>0;}
 uniform(){let t=this.state=(this.state+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
 normal(){return Math.sqrt(-2*Math.log(Math.max(this.uniform(),Number.MIN_VALUE)))*Math.cos(2*Math.PI*this.uniform());}
 shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(this.uniform()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
}
const sqsum=a=>a.reduce((s,v)=>s+v*v,0);
export class Network {
 constructor(p,fixture){
  this.p=p;this.n=N;this.s=p.ns;this.d=p.ns+1;this.size=N*this.d;
  const {np,aa,c,seed0}=p;
  this.patterns=fixture?.patterns?.map(a=>Int32Array.from(a))??[];
  if(!fixture)for(let mu=0;mu<np;mu++){
   const rng=new RNG(seed0+mu+1),a=new Int32Array(N);
   for(let i=0;i<Math.floor(N*aa);i++)a[i]=1+Math.floor(rng.uniform()*this.s);
   new RNG(seed0+1001+mu).shuffle(a);this.patterns.push(a);
  }
  const adjacency=Array.from({length:N},()=>[]);
  if(fixture){for(const [i,j] of fixture.edges){adjacency[i].push(j);adjacency[j].push(i);}}
  else for(let i=0;i<N;i++){
   const row=new Int32Array(N);row.fill(1,0,Math.floor(N*c));new RNG(seed0+2001+i).shuffle(row);
   for(let j=0;j<i;j++)if(row[j]){adjacency[i].push(j);adjacency[j].push(i);}
  }
  this.offsets=new Int32Array(N+1);const neighbors=[];
  for(let i=0;i<N;i++){this.offsets[i]=neighbors.length;neighbors.push(...adjacency[i].sort((a,b)=>a-b));}this.offsets[N]=neighbors.length;
  this.neighbors=Int32Array.from(neighbors);this.weights=new Float64Array(neighbors.length*this.s*this.s);
  const norm=N*c*aa*(1-aa/this.s),bias=aa/this.s;
  for(let i=0;i<N;i++)for(let e=this.offsets[i];e<this.offsets[i+1];e++){
   const j=neighbors[e],base=e*this.s*this.s;
   // J_ik,jl = Σμ (δξ_iμ,k − a/S)(δξ_jμ,l − a/S) / normalization.
   for(let k=1;k<=this.s;k++)for(let l=1;l<=this.s;l++){
    let sum=0;for(const pat of this.patterns)sum+=((pat[i]===k?1:0)-bias)*((pat[j]===l?1:0)-bias);
    this.weights[base+(k-1)*this.s+l-1]=sum/norm;
   }
  }
 }
 fields(q,out=new Float64Array(this.size)){
  out.fill(0);const {s,d,weights,neighbors,offsets}=this;
  for(let i=0;i<N;i++)for(let e=offsets[i];e<offsets[i+1];e++){
   const j=neighbors[e]*d,base=e*s*s,ii=i*d;
   for(let k=0;k<s;k++){let sum=0;const b=base+k*s;for(let l=0;l<s;l++)sum+=weights[b+l]*q[j+l+1];out[ii+k+1]+=sum;}
  }return out;
 }
 overlaps(q){
  const {aa}=this.p,bias=aa/this.s,norm=N*aa*(1-bias);let active=0;
  for(let i=0;i<N;i++)for(let k=1;k<=this.s;k++)active+=q[i*this.d+k];
  return this.patterns.map(pat=>{let sum=-bias*active;for(let i=0;i<N;i++)if(pat[i])sum+=q[i*this.d+pat[i]];return sum/norm;});
 }
 initial(){
  const {cue,cue_fraction,seed0,beta,uu}=this.p,q=new Float64Array(this.size),rng=new RNG(seed0+9000);
  for(let i=0;i<N;i++){const k=this.patterns[cue-1][i];q[i*this.d+(rng.uniform()<cue_fraction&&k>0?k:0)]=1;}
  const h=this.fields(q);this.softmax(h,q,beta,uu);return {q,h,r:h.slice()};
 }
 softmax(r,q,beta=this.p.beta,uu=this.p.uu){for(let i=0;i<N;i++){
  const b=i*this.d;let max=beta*uu;for(let k=1;k<=this.s;k++)max=Math.max(max,beta*r[b+k]);
  let sum=q[b]=Math.exp(beta*uu-max);for(let k=1;k<=this.s;k++)sum+=q[b+k]=Math.exp(beta*r[b+k]-max);
  for(let k=0;k<=this.s;k++)q[b+k]/=sum;
 }}
 energy(q,h=this.fields(q)){
  let interaction=0,entropy=0,active=0;for(let i=0;i<N;i++)for(let k=0;k<=this.s;k++){
   const idx=i*this.d+k,v=q[idx];if(v>0)entropy+=v*Math.log(v);if(k){interaction+=v*h[idx];active+=v;}
  }return (-0.5*interaction+this.p.uu*active+entropy/this.p.beta)/N;
 }
}
export class Simulation {
 constructor(model,config,fixture){
  this.model=model;this.isHamiltonian=model==='conservative'||model==='conservative_f0';this.p={...MODELS[model].defaults,...config};this.steps=validate(model,this.p);this.stepNumber=0;
  this.net=new Network(this.p,fixture);this.d=this.net.d;this.size=this.net.size;
  const state=this.net.initial();this.q=fixture?.state?.q?Float64Array.from(fixture.state.q):state.q;this.r=fixture?.state?.r?Float64Array.from(fixture.state.r):state.r;
  this.h=this.net.fields(this.q);this.theta=model==='conservative_f0'?null:new Float64Array(this.size);this.correction=0;this.crossings=0;
  this.rng=new RNG(this.p.noise_seed??this.p.momentum_seed??this.p.hidden_seed??1);
  if(model==='minimal'){
   // HPotts initializes θ from the discrete partial cue before softmax.
   const rng=new RNG(this.p.seed0+9000);for(let i=0;i<N;i++){const k=this.net.patterns[this.p.cue-1][i];if(rng.uniform()<this.p.cue_fraction&&k>0)this.theta[i*this.d+k]=1;}
   if(fixture?.state?.theta)this.theta.set(fixture.state.theta);
  }
  if(model==='hidden')this.initHidden(fixture?.state);
  if(this.isHamiltonian)this.initConservative(fixture?.state);
  if(model==='equilibrium'){
   this.z=new Float64Array(N*2*this.d);for(let i=0;i<N;i++)for(let k=0;k<this.d;k++)this.z[i*2*this.d+2*k]=Math.sqrt(this.q[i*this.d+k]);
   if(fixture?.state?.z)this.z.set(fixture.state.z);
   this.accepted=0;this.proposed=0;this.order=Int32Array.from({length:N},(_,i)=>i);
  }
  this.initialEnergy=this.sample().energy;
 }
 initHidden(state){
  const p=this.p;this.a=new Float64Array(this.size);this.u=new Float64Array(this.size);
  this.k11=p.rho+p.kappa;this.k12=p.rho*p.alpha-p.kappa;this.k22=p.rho*p.alpha*p.alpha+p.kappa+p.lambda;
  if(p.hidden_init===1)for(let i=0;i<N;i++)for(let k=1;k<this.d;k++){const j=i*this.d+k;this.a[j]=p.initial_a*this.q[j];this.u[j]=p.initial_u*this.q[j];}
  if(p.hidden_init===2){for(const pat of this.net.patterns){const v=p.initial_a*(2*this.rng.uniform()-1);for(let i=0;i<N;i++)if(pat[i])this.a[i*this.d+pat[i]]+=v;}}
  if(p.hidden_init===3)for(let i=0;i<N;i++)for(let k=1;k<this.d;k++)this.a[i*this.d+k]=p.initial_a*(2*this.rng.uniform()-1);
  if(p.hidden_init>=2)for(let j=0;j<this.size;j++)this.u[j]=-this.a[j]/p.alpha;
  if(state?.a)this.a.set(state.a);if(state?.u)this.u.set(state.u);
  this.buffers=Array.from({length:5},()=>({q:new Float64Array(this.size),a:new Float64Array(this.size),u:new Float64Array(this.size)}));
 }
 initConservative(state){
  const p=this.p;this.z=Float64Array.from(this.q,Math.sqrt);this.pz=new Float64Array(this.size);this.pt=this.theta?new Float64Array(this.size):null;
  for(let i=0;i<N;i++){
   const b=i*this.d;let radial=0;
   for(let k=0;k<this.d;k++){const j=b+k;this.pz[j]=this.rng.normal();radial+=this.z[j]*this.pz[j];}
   for(let k=0;k<this.d;k++)this.pz[b+k]-=this.z[b+k]*radial;
   if(this.pt)for(let k=1;k<this.d;k++){const j=b+k;this.pt[j]=this.rng.normal();this.theta[j]=p.theta_initial_scale*this.q[j];}
  }
  const scale=Math.sqrt(8*p.mass_sigma*N*p.kinetic_sigma/p.beta/sqsum(this.pz));
  for(let j=0;j<this.size;j++)this.pz[j]*=scale;
  if(this.pt){const scaleT=Math.sqrt(2*p.mass_theta*N*p.kinetic_theta/sqsum(this.pt));for(let j=0;j<this.size;j++)this.pt[j]*=scaleT;}
  for(const key of ['z','pz','theta','pt'])if(this[key]&&state?.[key])this[key].set(state[key]);
  this.fz=new Float64Array(this.size);this.ft=this.theta?new Float64Array(this.size):null;this.force();
  this.start=Object.fromEntries(['z','pz','theta','pt'].filter(key=>this[key]).map(key=>[key,this[key].slice()]));
 }
 check(q=this.q){
  let error=0,min=Infinity;for(let i=0;i<N;i++){let sum=0;for(let k=0;k<this.d;k++){const v=q[i*this.d+k];if(!Number.isFinite(v)||v<0||((this.model==='hidden'||this.model==='equilibrium')&&v===0))throw Error('The state left the probability simplex. Reduce dt or gain.');sum+=v;min=Math.min(min,v);}error=Math.max(error,Math.abs(sum-1));}
  if(error>1e-10)throw Error('Probability normalization failed. Reduce dt.');return {error,min};
 }
 step(){
  if(this.model==='minimal')this.adaptive();
  else if(this.model==='hidden')this.hidden();
  else if(this.isHamiltonian)this.conservative();
  else this.equilibrium();
  this.stepNumber++;
 }
 adaptive(){
  const p=this.p;this.net.fields(this.q,this.h);
  for(let i=0;i<N;i++)for(let k=1;k<this.d;k++){
   const j=i*this.d+k;
   this.r[j]+=p.dt*(this.h[j]-this.theta[j]-this.r[j])/p.tau_r;
   this.theta[j]+=p.dt*(this.q[j]-this.theta[j])/p.tau_theta;
  }this.net.softmax(this.r,this.q);
 }
 hiddenRhs(q,a,u,out){
  this.check(q);this.net.fields(q,this.h);const p=this.p;out.q.fill(0);out.a.fill(0);out.u.fill(0);
  for(let i=0;i<N;i++){
   const b=i*this.d;let average=0;
   for(let k=1;k<this.d;k++){const j=b+k;
    const g=-this.h[j]+p.uu+Math.log(q[j]/q[b])/p.beta+p.coupling*(a[j]+p.alpha*u[j]);
    out.q[j]=g;average+=q[j]*g;
    out.a[j]=-(this.k11*a[j]+this.k12*u[j]+p.coupling*q[j])/p.tau_a;
    out.u[j]=-(this.k12*a[j]+this.k22*u[j]+p.coupling*p.alpha*q[j])/p.tau_u;
   }
   for(let k=1;k<this.d;k++){const j=b+k;out.q[j]=-p.beta/p.tau_r*q[j]*(out.q[j]-average);}
   out.q[b]=p.beta/p.tau_r*q[b]*average;
  }
 }
 hidden(){
  const [k1,k2,k3,k4,tmp]=this.buffers,p=this.p;
  this.hiddenRhs(this.q,this.a,this.u,k1);
  const stage=(rhs,scale)=>{for(const key of ['q','a','u'])for(let j=0;j<this.size;j++)tmp[key][j]=this[key][j]+scale*p.dt*rhs[key][j];};
  stage(k1,0.5);this.hiddenRhs(tmp.q,tmp.a,tmp.u,k2);
  stage(k2,0.5);this.hiddenRhs(tmp.q,tmp.a,tmp.u,k3);
  stage(k3,1);this.hiddenRhs(tmp.q,tmp.a,tmp.u,k4);
  for(const key of ['q','a','u'])for(let j=0;j<this.size;j++){
   this[key][j]+=p.dt/6*(k1[key][j]+2*k2[key][j]+2*k3[key][j]+k4[key][j]);
   if(!Number.isFinite(this[key][j]))throw Error('Non-finite hidden state. Reduce dt.');
  }
  this.check();for(let i=0;i<N;i++){let sum=0;for(let k=0;k<this.d;k++)sum+=this.q[i*this.d+k];for(let k=0;k<this.d;k++){const j=i*this.d+k,v=this.q[j]/sum;this.correction=Math.max(this.correction,Math.abs(v-this.q[j]));this.q[j]=v;}}
 }
 force(){
  for(let j=0;j<this.size;j++)this.q[j]=this.z[j]*this.z[j];this.net.fields(this.q,this.h);const p=this.p;
  for(let i=0;i<N;i++){
   const b=i*this.d;let radial=0,norm=0;
   for(let k=0;k<this.d;k++){
    const j=b+k,z=this.z[j];let g=z===0?0:2*z*(2*Math.log(Math.abs(z))+1)/p.beta;
    if(k)g+=2*z*(p.uu-this.h[j]+(this.theta?.[j]??0));this.fz[j]=g;radial+=z*g;norm+=z*z;
    if(this.ft)this.ft[j]=k?-this.q[j]-this.theta[j]:0;
   }for(let k=0;k<this.d;k++){const j=b+k;this.fz[j]=-this.fz[j]+this.z[j]*radial/norm;}
  }
 }
 cleanFrame(i){
  const b=i*this.d;let zn=0,pn=0,rad=0;for(let k=0;k<this.d;k++){const j=b+k;zn+=this.z[j]**2;pn+=this.pz[j]**2;rad+=this.z[j]*this.pz[j];}
  zn=Math.sqrt(zn);pn=Math.sqrt(pn);this.correction=Math.max(this.correction,Math.abs(zn-1),Math.abs(rad)/Math.max(1,pn));
  if(this.correction>1e-10)throw Error('Sphere constraint correction exceeded roundoff. Reduce dt.');
  rad=0;for(let k=0;k<this.d;k++){const j=b+k;this.z[j]/=zn;rad+=this.z[j]*this.pz[j];}
  let tn=0;for(let k=0;k<this.d;k++){const j=b+k;this.pz[j]-=this.z[j]*rad;tn+=this.pz[j]**2;}
  if(pn>Number.MIN_VALUE){const scale=pn/Math.sqrt(tn);for(let k=0;k<this.d;k++)this.pz[b+k]*=scale;}
 }
 conservative(){
  const p=this.p;
  for(let j=0;j<this.size;j++){this.pz[j]+=p.dt/2*this.fz[j];if(this.pt)this.pt[j]+=p.dt/2*this.ft[j];}
  for(let i=0;i<N;i++){
   this.cleanFrame(i);const b=i*this.d;let pn=0;for(let k=0;k<this.d;k++)pn+=this.pz[b+k]**2;pn=Math.sqrt(pn);
   if(pn>Number.MIN_VALUE){const angle=p.beta*pn*p.dt/(4*p.mass_sigma),cs=Math.cos(angle),sn=Math.sin(angle);
    for(let k=0;k<this.d;k++){const j=b+k,z=this.z[j],v=this.pz[j];this.z[j]=cs*z+sn*v/pn;this.pz[j]=cs*v-sn*pn*z;if(z*this.z[j]<0)this.crossings++;}
   }this.cleanFrame(i);
  }
  if(this.pt)for(let j=0;j<this.size;j++)this.theta[j]+=p.dt*this.pt[j]/p.mass_theta;
  this.force();for(let j=0;j<this.size;j++){this.pz[j]+=p.dt/2*this.fz[j];if(this.pt)this.pt[j]+=p.dt/2*this.ft[j];if(!Number.isFinite(this.z[j]+this.pz[j]+(this.theta?.[j]??0)+(this.pt?.[j]??0)))throw Error('Non-finite Hamiltonian state. Reduce dt.');}
 }
 sphereDrift(z,prob,field){
  const p=this.p,g=new Float64Array(this.d);let avg=0;
  for(let k=0;k<this.d;k++){g[k]=Math.log(prob[k])/p.beta+(k?p.uu-field[k]:0);avg+=prob[k]*g[k];}
  const drift=new Float64Array(2*this.d);for(let k=0;k<this.d;k++)for(let a=0;a<2;a++)drift[2*k+a]=-p.beta/(2*p.tau_r)*z[2*k+a]*(g[k]-avg);return drift;
 }
 moveSite(i,providedNoise,providedUniform){
  const p=this.p,b=i*this.d,zb=2*b,dim=2*this.d,old=this.z.slice(zb,zb+dim),prob=this.q.slice(b,b+this.d),field=this.h.slice(b,b+this.d);
  const drift=this.sphereDrift(old,prob,field),noise=providedNoise?Float64Array.from(providedNoise):Float64Array.from({length:dim},()=>this.rng.normal());
  let radial=0;for(let j=0;j<dim;j++)radial+=old[j]*noise[j];
  const variance=p.beta*p.temperature*p.dt/(2*p.tau_r),forward=new Float64Array(dim);let norm=1;
  for(let j=0;j<dim;j++){noise[j]-=old[j]*radial;forward[j]=p.dt*drift[j]+Math.sqrt(variance)*noise[j];norm+=forward[j]**2;}
  norm=Math.sqrt(norm);const next=new Float64Array(dim),newprob=new Float64Array(this.d);
  for(let j=0;j<dim;j++)next[j]=(old[j]+forward[j])/norm;
  for(let k=0;k<this.d;k++)newprob[k]=next[2*k]**2+next[2*k+1]**2;
  this.proposed++;if(newprob.some(v=>!Number.isFinite(v)||v<=0))return {accepted:false};
  let df=0;for(let k=0;k<this.d;k++)df+=(newprob[k]*Math.log(newprob[k])-prob[k]*Math.log(prob[k]))/p.beta+(k?(p.uu-field[k])*(newprob[k]-prob[k]):0);
  const driftNew=this.sphereDrift(next,newprob,field);let a=0;for(let j=0;j<dim;j++)a+=old[j]*next[j];
  if(a<=0)throw Error('Invalid sphere proposal. Reduce dt.');let f2=0,r2=0;
  for(let j=0;j<dim;j++){f2+=(next[j]/a-old[j]-p.dt*drift[j])**2;r2+=(old[j]/a-next[j]-p.dt*driftNew[j])**2;}
  const logAccept=-df/p.temperature-(r2-f2)/(2*variance),u=providedUniform??this.rng.uniform();
  if(Math.log(Math.max(u,Number.MIN_VALUE))>Math.min(0,logAccept))return {accepted:false,df,logAccept,newprob};
  this.accepted++;this.z.set(next,zb);this.q.set(newprob,b);
  // Symmetric J: W_ik,jl updates h_jl by W_ik,jl delta_sigma_ik.
  const {offsets,neighbors,weights,s}=this.net;
  for(let e=offsets[i];e<offsets[i+1];e++){
   const jj=neighbors[e]*this.d,base=e*s*s;
   for(let l=0;l<s;l++){let v=0;for(let k=0;k<s;k++)v+=weights[base+k*s+l]*(newprob[k+1]-prob[k+1]);this.h[jj+l+1]+=v;}
  }return {accepted:true,df,logAccept,newprob};
 }
 equilibrium(){this.rng.shuffle(this.order);for(const i of this.order)this.moveSite(i);}
 sample(){
  this.check();const p=this.p;this.net.fields(this.q,this.h);const f0=this.net.energy(this.q,this.h),overlaps=this.net.overlaps(this.q);
  let energy=f0,potential=f0,kinetic=0,coupling=0,quadratic=0,dissipation=0;const diagnostic={};
  if(this.model==='hidden'){
   for(let j=0;j<this.size;j++){const a=this.a[j],u=this.u[j];this.theta[j]=p.coupling*(a+p.alpha*u);coupling+=this.q[j]*this.theta[j];quadratic+=0.5*(this.k11*a*a+2*this.k12*a*u+this.k22*u*u);}
   energy=potential=f0+(coupling+quadratic)/N;const rhs=this.buffers[0];this.hiddenRhs(this.q,this.a,this.u,rhs);
   for(let j=0;j<this.size;j++)dissipation-=p.tau_a*rhs.a[j]**2+p.tau_u*rhs.u[j]**2;
   for(let i=0;i<N;i++)for(let k=0;k<this.d;k++){const j=i*this.d+k;if(this.q[j]>0)dissipation-=p.tau_r/p.beta*rhs.q[j]**2/this.q[j];}
   diagnostic.dissipation=dissipation/N;
  }
  if(this.isHamiltonian){
   if(this.theta)for(let j=0;j<this.size;j++){coupling+=this.q[j]*this.theta[j];quadratic+=0.5*this.theta[j]**2;}
   potential=f0+(coupling+quadratic)/N;const ks=p.beta*sqsum(this.pz)/(8*p.mass_sigma*N),kt=this.pt?sqsum(this.pt)/(2*p.mass_theta*N):0;kinetic=ks+kt;energy=potential+kinetic;
   Object.assign(diagnostic,{kinetic_sigma:ks,...(this.pt?{kinetic_theta:kt}:{}),energy_error:this.initialEnergy===undefined?0:energy-this.initialEnergy,boundary_crossings:this.crossings});
  }
  if(this.model==='equilibrium'){
   diagnostic.acceptance=this.proposed?this.accepted/this.proposed:0;this.accepted=0;this.proposed=0;
  }
  const {error,min}=this.check();Object.assign(diagnostic,{normalization_error:error,min_probability:min,roundoff_correction:this.correction});
  let active=0;for(let i=0;i<N;i++)active+=1-this.q[i*this.d];
  return {time:this.stepNumber*p.dt,overlaps,energy,f0,potential,kinetic,coupling:coupling/N,quadratic:quadratic/N,active:active/N,theta:!this.theta||this.model==='equilibrium'?[]:this.net.overlaps(this.theta),diagnostic};
 }
 snapshot(){const state={q:Array.from(this.q)};for(const k of ['r','theta','a','u','z','pz','pt'])if(this[k])state[k]=Array.from(this[k]);return state;}
 reverseMomenta(){for(let j=0;j<this.size;j++){this.pz[j]*=-1;if(this.pt)this.pt[j]*=-1;}}
 reversalError(){let position=0,momentum=0;for(let j=0;j<this.size;j++){position=Math.max(position,Math.abs(this.z[j]-this.start.z[j]),this.theta?Math.abs(this.theta[j]-this.start.theta[j]):0);momentum=Math.max(momentum,Math.abs(this.pz[j]+this.start.pz[j]),this.pt?Math.abs(this.pt[j]+this.start.pt[j]):0);}return {position,momentum};}
}
