export const N = 250; // Default size; each run uses config.n.
export const NETWORK_SIZES = [250,500,1000];
export const MAX_WEIGHT_BYTES = 256*1024*1024;
export const SOURCE = '887d50e81b4b55d83370cf7e7b41eb8b904e5a5f';
const common = { n:N, ns:7, memory_load:0.1, c:0.2, aa:0.15, beta:10, uu:0.1, seed0:1, cue:1, cue_fraction:0.66 };
export const MODELS = {
  minimal: { name:'Adaptive Potts', short:'Adaptive', caption:'State-specific adaptation drives memory latching.', equation:'τᵣ ṙ = h − θ − r     ·     τθ θ̇ = σ − θ', method:'Synchronous Euler', energy:'F₀ / N', defaults:{...common,tau_r:1,tau_theta:20,dt:0.05,duration:500,save_every:10} },
  equilibrium: { name:'Equilibrium noise', short:'Equilibrium', caption:'Simplex-preserving Itô noise explores the memory landscape.', equation:'dσ = [−M ∇F₀ + T div M] dt + √(2T M) dW', method:'Metropolis-adjusted tangent Langevin; two sphere coordinates per category', energy:'F₀ / N', defaults:{...common,tau_r:1,temperature:0.02,noise_seed:101,dt:0.01,duration:2000,save_every:100} },
  conservative: { name:'Conservative Hamiltonian', short:'Conservative', caption:'Activity and a slow threshold oscillator exchange energy.', equation:'H = F₀ + σ·θ + ½|θ|² + β|p_z|²/(8mσ) + |pθ|²/(2mθ)', method:'Geodesic kick–drift–kick Verlet with signed amplitudes', energy:'H / N', defaults:{...common,uu:0.4,mass_sigma:1,mass_theta:400,kinetic_sigma:0.01,kinetic_theta:0,theta_initial_scale:0,momentum_seed:201,dt:0.005,duration:1000,save_every:100,reverse_check:0} },
  conservative_f0: { name:'Conservative F₀', short:'Conservative F₀', caption:'Activity inertia explores the F₀ landscape at fixed total energy.', equation:'H = F₀ + β|p_z|²/(8mσ)', method:'Geodesic kick–drift–kick Verlet with signed amplitudes', energy:'H / N', defaults:{...common,mass_sigma:1,kinetic_sigma:0.01,momentum_seed:201,prepare_f0:0,target_f0:-0.11,f0_tolerance:0.001,dt:0.005,duration:1000,save_every:100,reverse_check:0} },
  hidden: { name:'Hidden-variable relaxation', short:'Hidden variables', caption:'Two reciprocal hidden fields create a transient adaptive threshold.', equation:'θ = g(a + αu)     ·     Fext = F₀ + g σ·(a + αu) + ½(a,u)K(a,u)ᵀ', method:'Direct probability-space RK4', energy:'Fext / N', defaults:{...common,tau_r:1,tau_a:200,tau_u:10,alpha:1,rho:10,kappa:0,lambda:5,coupling:1.2,hidden_init:1,hidden_seed:301,initial_a:1,initial_u:0,dt:0.2,duration:50,save_every:1} }
};
// Display ranges also define browser resource limits; numeric boxes allow precise input.
const p=(label,symbol,min,max,step,help,group='Dynamics')=>({label,symbol,min,max,step,help,group});
export const PARAMS = {
 n:{...p('Network size','N',250,1000,1,'Number of units. Stored memories scale automatically as p = round(αN). At α = 0.1, the three sizes use 25, 50 and 100 memories. Coupling work grows approximately as N².','Network'),options:['250 units (1×)','500 units (2×)','1,000 units (4×)'],values:NETWORK_SIZES},
 ns:p('Active states','S',1,12,1,'Number of active Potts categories. State 0 is inactive.','Network'),
 memory_load:p('Memory load','α = p/N',0.001,0.4,0.001,'Stored memories scale with network size: p = round(αN). Default α = 0.1 gives 25, 50 or 100 memories. At least one memory is required.','Network'),
 c:p('Connectivity','c',0.01,1,0.01,'Symmetric diluted graph. floor(Nc) is the row-proposal size, not a fixed degree.','Network'),
 aa:p('Memory sparsity','a',0.01,0.95,0.01,'Each memory has floor(Na) active units.','Network'),
 beta:p('Gain','β',0.1,50,0.1,'Inverse categorical softness; entropy coefficient is 1/β.'),
 uu:p('Inactive threshold','U',-1,2,0.01,'Inactive logit is βU; the energy contains +U times active mass.'),
 tau_r:p('Activity timescale','τᵣ',0.01,100,0.01,'Must exceed the integration step.'),
 tau_theta:p('Adaptation timescale','τθ',0.01,1000,0.01,'Threshold relaxation time. Must exceed dt.'),
 temperature:p('Temperature','T',0.000001,0.2,0.000001,'Physical noise temperature, independent of the softmax gain β.'),
 mass_sigma:p('Activity mass','mσ',0.001,100,0.001,'Mass in the spherical activity kinetic energy.'),
 prepare_f0:{...p('Prepare target mean F₀','',0,1,1,'Rescale momenta by 1.001 (or its reciprocal) after each step, using only the last 100 integration steps. Stop permanently after 100 consecutive full-window means lie within tolerance. H is not conserved during preparation.'),options:['Off','On']},
 target_f0:{...p('Target mean F₀ per unit','⟨F₀⟩/N',-10,10,0.001,'Target for the rolling mean of F₀/N over the last 100 integration steps, independent of plot sampling. Default −0.11.'),numberOnly:true},
 f0_tolerance:{...p('Target tolerance','ε / N',0.000001,1,0.000001,'Absolute tolerance for the rolling mean of F₀/N. Release after 100 consecutive means inside this band. No rescaling inside the band.'),numberOnly:true},
 mass_theta:p('Threshold mass','mθ',0.01,10000,0.01,'Sets the slow threshold oscillator timescale.'),
 kinetic_sigma:p('Initial activity kinetic energy','Kσ/N',0,1,0.001,'Initial activity kinetic energy per unit; random tangent momentum directions.'),
 kinetic_theta:p('Initial threshold kinetic energy','Kθ/N',0,1,0.001,'Initial threshold kinetic energy per unit.'),
 theta_initial_scale:p('Initial threshold scale','θ₀/σ₀',-5,5,0.05,'θ initially equals this scale times the initial active probability.'),
 tau_a:p('First hidden timescale','τa',0.01,1000,0.01,'Relaxation time of the first hidden field.'),
 tau_u:p('Second hidden timescale','τu',0.01,1000,0.01,'Relaxation time of the second hidden field.'),
 alpha:p('Hidden mixture','α (mixture)',-5,5,0.05,'θ = coupling × (a + αu). This hidden-mixture coefficient is independent of network memory load. Cancelled initializations require α ≠ 0.'),
 rho:p('Mixture stiffness','ρ',0,10,0.05,'Coefficient of (a + αu)² / 2 in the hidden potential.'),
 kappa:p('Difference stiffness','κ',0,10,0.05,'Coefficient of (a − u)² / 2 in the hidden potential.'),
 lambda:p('Second-field stiffness','λ',0,10,0.05,'Coefficient of u² / 2. The hidden Hessian must be positive definite.'),
 coupling:p('Reciprocal coupling','g',-5,5,0.05,'Couples σ to the hidden mixture in both activity and hidden dynamics.'),
 hidden_init:{...p('Hidden initialization','',0,3,1,'Zero; activity-scaled fields; cancelled random memory load; or cancelled local load.','Initialization'),options:['Zero fields','Activity-scaled fields','Cancelled memory load','Cancelled local load']},
 initial_a:p('First hidden amplitude','a₀',-10,10,0.05,'Scale of the prepared first hidden field.','Initialization'),
 initial_u:p('Second hidden amplitude','u₀',-10,10,0.05,'Used only in activity-scaled initialization; cancelled modes set u = −a/α.','Initialization'),
 cue:p('Cued memory','μ',1,400,1,'Memory index, starting from 1.','Initialization'),
 cue_fraction:p('Cue fraction','f cue',0.01,1,0.01,'Probability of cuing each active unit of the selected memory.','Initialization'),
 seed0:p('Network seed','seed',0,2147480000,1,'Reproducible memories, connectivity and partial cue.','Initialization'),
 noise_seed:p('Noise seed','seed T',0,2147480000,1,'Independent stream for equilibrium proposals and acceptance.','Initialization'),
 momentum_seed:p('Momentum seed','seed p',0,2147480000,1,'Independent initial momentum directions.','Initialization'),
 hidden_seed:p('Hidden seed','seed h',0,2147480000,1,'Independent stream for cancelled hidden loads.','Initialization'),
 dt:p('Integration step','dt',0.00001,0.5,0.00001,'Smaller steps improve accuracy. Duration must be an exact multiple of dt.','Integration'),
 duration:p('Simulation duration','t max',0.01,5000,0.01,'Total physical time. Long runs continue in the background worker.','Integration'),
 save_every:p('Sample every … steps','sample',1,10000,1,'Plot and export cadence; the final point is always included.','Integration'),
 reverse_check:{...p('Time reversal check','',0,1,1,'After the conservative run, reverse all momenta and retrace the full trajectory.','Integration'),options:['Off','On']}
};
export function memoryCount(config){return Math.round(config.memory_load*config.n);}
export function simulationConfig(model,config={}){
 const selected={...MODELS[model].defaults,...config};
 // Preserve old engine/reference configurations that supplied a count only.
 if(config.memory_load===undefined&&config.np!==undefined)selected.memory_load=config.np/selected.n;
 return {...selected,np:config.np??memoryCount(selected)};
}
export function validate(model,config) {
 if(!MODELS[model]) throw Error('Choose a valid model.');
 const keys=Object.keys(MODELS[model].defaults);
 for(const key of keys){const v=config[key],m=PARAMS[key];if(!Number.isFinite(v)||v<m.min||v>m.max)throw Error(`${m.label}: enter a value between ${m.min} and ${m.max}.`);if(m.step===1&&!Number.isInteger(v))throw Error(`${m.label} must be an integer.`);}
 if(!NETWORK_SIZES.includes(config.n))throw Error('Network size must be 250, 500 or 1000 units.');
 if(config.n*(config.n-1)*config.c*config.ns*config.ns*8>MAX_WEIGHT_BYTES)throw Error('This size, connectivity and state count need more than 256 MiB for weights. Reduce connectivity or active states, or choose a smaller network.');
 const count=memoryCount(config);
 if(!Number.isInteger(count)||count<1||count>400)throw Error('Memory load and network size must give between 1 and 400 stored memories.');
 if(config.np!==undefined&&config.np!==count)throw Error('Stored-memory count must equal round(αN).');
 if(config.cue>count) throw Error('The cued memory must be within the number of stored memories.');
 if(config.tau_r!==undefined && config.dt>=config.tau_r)throw Error('dt must be smaller than the activity timescale.');
 for(const k of ['tau_theta','tau_a','tau_u'])if(config[k]!==undefined&&config.dt>=config[k])throw Error(`dt must be smaller than ${PARAMS[k].label.toLowerCase()}.`);
 const steps=Math.round(config.duration/config.dt);
 if(Math.abs(steps*config.dt-config.duration)>1e-9)throw Error('Duration must be an exact multiple of dt.');
 if(steps>2000000)throw Error('Use at most 2,000,000 integration steps per browser run.');
 if(Math.ceil(steps/config.save_every)>20000)throw Error('Increase the sample interval to keep the run within 20,000 plot samples.');
 if(model==='conservative_f0'&&config.prepare_f0&&config.reverse_check)throw Error('Turn off the full-run time reversal check during target preparation: momentum rescaling is not reversible.');
 if(model==='hidden'){
 const {rho,kappa,lambda,alpha,hidden_init}=config;
 const a=rho+kappa,b=rho*alpha-kappa,d=rho*alpha*alpha+kappa+lambda;
 if(a<=0||a*d-b*b<=1e-12)throw Error('The hidden Hessian must be positive definite. Increase a stiffness.');
 if(hidden_init>=2&&Math.abs(alpha)<1e-12)throw Error('Cancelled hidden initialization requires a nonzero α.');
 }
 return steps;
}
