// LaTeX compiled to accessible native MathML at build time, with no CDN scripts.
const energy = String.raw`F_0(\sigma)=-\frac12\sum_{i,j}\sum_{k,l=1}^{S}J_{ij}^{kl}\sigma_i^k\sigma_j^l+U\sum_i\sum_{k=1}^{S}\sigma_i^k+\frac1\beta\sum_i\sum_{k=0}^{S}\sigma_i^k\ln\sigma_i^k`;
const mobility = String.raw`M_i=\frac{\beta}{\tau_r}\left[\operatorname{diag}(\sigma_i)-\sigma_i\sigma_i^{\mathsf T}\right]`;
const notation = 'Vectors σᵢ contain the S active probabilities. The inactive probability is σᵢ⁰ = 1 − ∑ₖ₌₁ˢ σᵢᵏ; the entropy includes all S + 1 categories.';
export const EQUATIONS = {
 equilibrium: {
  rows: [
   {label:'Activity energy',latex:energy},
   {label:'Itô Langevin dynamics',latex:String.raw`d\sigma_i=\left[-M_i\nabla_{\sigma_i}F_0+T\,\operatorname{div}_{\sigma_i}M_i\right]dt+B_i\,dW_i`},
   {label:'Mobility and noise',latex:String.raw`${mobility},\qquad B_iB_i^{\mathsf T}=2T M_i`},
   {label:'Equilibrium law',latex:String.raw`P_{\mathrm{eq}}(\sigma)\propto e^{-F_0(\sigma)/T}\quad\text{(flat simplex measure)}`}
  ], note:notation+' T controls noise; β controls the entropy term. The finite-step sampler uses a Metropolis correction.'
 },
 conservative: {
  rows: [
   {label:'Activity energy',latex:energy},
   {label:'Hamiltonian',latex:String.raw`\begin{aligned}H&=V+\frac{\beta}{8m_\sigma}\sum_i\lVert p_{z,i}\rVert^2+\frac{1}{2m_\theta}\sum_i\lVert p_{\theta,i}\rVert^2,\\V&=F_0(\sigma)+\sum_i\left(\sigma_i\cdot\theta_i+\frac12\lVert\theta_i\rVert^2\right)\end{aligned}`},
   {label:'Masses and motion',latex:String.raw`\dot z_i=\frac{\beta}{4m_\sigma}p_{z,i},\qquad\dot\theta_i=\frac{p_{\theta,i}}{m_\theta},\qquad m_\theta\ddot\theta_i=-\theta_i-\sigma_i,\qquad m_\sigma,m_\theta>0`},
   {label:'Probability geometry',latex:String.raw`\sigma_i^k=(z_i^k)^2\ (k=0,\ldots,S),\qquad\lVert z_i\rVert^2=1,\qquad z_i\cdot p_{z,i}=0,\qquad\frac{dH}{dt}=0`}
  ], note:notation+' zᵢ and pz,ᵢ include the inactive coordinate. The masses set the activity and threshold inertia; total H is conserved by the continuous dynamics.'
 },
 hidden: {
  rows: [
   {label:'Activity energy',latex:energy},
   {label:'Threshold and potential',latex:String.raw`\begin{aligned}\theta_i&=g(a_i+\alpha u_i),\\F_{\mathrm{ext}}&=F_0+\sum_i\left[\sigma_i\cdot\theta_i+\frac{\rho}{2}\lVert a_i+\alpha u_i\rVert^2+\frac{\kappa}{2}\lVert a_i-u_i\rVert^2+\frac{\lambda}{2}\lVert u_i\rVert^2\right]\end{aligned}`},
   {label:'Activity relaxation',latex:String.raw`\dot\sigma_i=-M_i\nabla_{\sigma_i}F_{\mathrm{ext}},\qquad ${mobility}`},
   {label:'Hidden relaxation',latex:String.raw`\begin{aligned}\tau_a\dot a_i&=-\rho(a_i+\alpha u_i)-\kappa(a_i-u_i)-g\sigma_i,\\\tau_u\dot u_i&=-\rho\alpha(a_i+\alpha u_i)+\kappa(a_i-u_i)-\lambda u_i-g\alpha\sigma_i\end{aligned}`}
  ], note:notation+' The full extended potential decreases under the continuous gradient flow. Prepared hidden fields can supply a transient threshold; F₀ alone need not decrease.'
 }
};
