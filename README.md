# HPottsViz

Five interactive Potts memory models, in the white, purple and pastel-panel style
of [PottsViz](https://pottsviz.vercel.app). Live overlapping-memory trajectories,
energy diagnostics, memory heatmap, 250-unit state grid and threshold projections.

- Adaptive Potts: synchronous Euler with sigma-driven adaptation.
- Equilibrium noise: the flat-simplex Gibbs sampler using two sphere coordinates
  per category, tangent Langevin proposals and Metropolis correction.
- Conservative Hamiltonian: signed sphere amplitudes, tangent activity momenta,
  threshold momenta and geodesic Verlet; optional full time-reversal check.
- Conservative F₀: activity-only inertial motion with H = F₀ + β|pz|²/(8mσ),
  signed sphere amplitudes and tangent momenta. No adaptive threshold, threshold
  momenta or noise. Initial K/N is adjustable; mass and momentum seed are editable.
  Energy plots show H/N, F₀/N and K/N, with initial energy and drift diagnostics.
- Hidden-variable relaxation: direct sigma-space RK4, reciprocal quadratic
  hidden fields and all four hidden initialization modes.

The deterministic gradient-descent reference is not a UI model. Every namelist
parameter for the original four selected models is editable except network size, fixed
at **250**. Equilibrium and conservative defaults match the thesis figure
parameters (`equilibrium_structured_U0p1_T0p02.json` and `conservative_U0p4.json`).
Hidden defaults match the screenshot-verified `fresh.csv` run recorded in the
thesis as `hidden_transient_hpottsviz.json`: activity-scaled initialization,
ρ=10, κ=0, λ=5, g=1.2, dt=0.2, duration 50 and sampling every step.
Adaptive defaults retain the HPotts baseline configuration.
Numeric inputs complement sliders; hidden controls are enabled for the applicable
initialization. Browser resource limits cap S at 12, memories at 100, integration
steps at 2,000,000 and saved samples at 20,000; other ranges are in `lib/models.js`.

Simulations run in a module Web Worker, with live updates, pause, resume, stop,
plot time windows, CSV export and full-run JSON export. No server computation,
credentials or third-party runtime scripts are required. LaTeX is rendered with
KaTeX at build time into native MathML; there is no runtime math dependency.
All five models display their key equations below their subtitles. The final
section contains numerical methods, interpretation and reproducibility notes
without repeated equations.
Adaptive dynamics show active fraction instead of an energy metric and have no
energy plot: F₀ is not a Lyapunov function for the coupled adaptive flow.
Import/export params JSON uses the current control values, independently of the
last run. Files identify their model and restore all its controls, including seeds
and initialization choices. Imports are validated before applying any changes;
parameter import/export is disabled during running and paused simulations.
Full-run JSON files can also be imported to restore their parameters.
Changing models clears the plot; each model retains its own parameter choices.

## Exploring the activity-only conservative model

Open `/?model=conservative_f0`. Start with the default U=0.1, mσ=1,
K(0)/N=0.01 and dt=0.005. Compare several initial kinetic energies with the
network seed, cue and momentum seed held fixed. Changing K rescales the same
random tangent momentum directions; there is no continuing stochastic forcing.
For a fixed initial cue, H(0)/N = F₀(σ(0))/N + K(0)/N. The audit under the energy
plot reports this decomposition and ΔH/N. Mass changes the timescale, while
K changes the total energy. K=0 means initial rest; potential forces can still
accelerate activity. The existing partial-cue initialization is retained rather
than first minimizing F₀. Consequently, the accessible energy range for that
initial position begins at F₀(σ(0)); changing the cue or U changes that baseline.
A retrieval window is not assumed: compare memory overlaps and heatmaps, then
check promising runs with smaller dt, longer durations and additional seeds.
Signed amplitudes continue through zero, preserving nonnegative normalized
probabilities. Continuous H is conserved; finite-step energy error is reported
without rescaling momenta to hide it.

### Optional preparation at a target mean F₀

In **Conservative F₀**, set **Prepare target mean F₀ → On**, then enter
**Target mean F₀ per unit** (default **−0.11**) and **Target tolerance**
(default **0.001**). Preparation is off by default. Targets and tolerance use
F₀/N, matching the energy plot; they are not total network energy values.

The controller waits for 100 completed integration steps, then uses a rolling
mean of exactly the latest 100 post-step F₀/N values. This is independent of
`save_every`; t=0 is not included. After each step it multiplies all activity
momenta (equivalently velocities, for fixed mass) by **1.001** when the mean
is below target, or divides by **1.001** when it is above target. Inside the
tolerance band it leaves momenta unchanged. This uniform scaling preserves
tangency and does not change probabilities at that step.

Release occurs after **100 consecutive full-window means** lie within the
tolerance band. Rescaling then switches off permanently, even if the rolling
mean later moves away from target. The first possible release is step 199.
The total simulation duration includes preparation. If the run ends first,
the UI explicitly reports that the target did not stabilize; it does not claim
a conservative observation phase occurred. Some targets may be unattainable.

H deliberately changes during preparation. At release, the engine records the
current H/N and uses it as the new energy-drift reference. The plots include
the rolling mean and target; diagnostics and CSV/full JSON exports record the
phase, rolling mean, rescaling count, release step and release energy. The exact
release point is saved even if it falls between regular plot samples. Full-run
time reversal is disabled with preparation because rescaling is not reversible.
After release only H, rather than the mean F₀, is constrained to remain constant
by the continuous dynamics. Old Conservative F₀ parameter exports still import
with preparation off and the new target/tolerance defaults.

## Local development

```sh
npm test
npm run build
python -m http.server 8000 --directory dist
```

Open http://localhost:8000. Vercel runs `npm run build` and serves `dist`.
The canonical project is `hpottsviz`; production deploys from `main`.

## Scientific provenance

Ported from [a7dita/HPotts](https://github.com/a7dita/HPotts), source commit
`887d50e81b4b55d83370cf7e7b41eb8b904e5a5f`, specifically the four
`src/{minimal,equilibrium,conservative,hidden}_potts.f90` implementations.
Weights, initialization conventions, normalization, energy signs, mobility,
geometry and integrators follow that code. The fifth model, `conservative_f0`,
is an HPottsViz extension using the same activity kinetic geometry and geodesic
Verlet integrator with F₀ as its entire potential. It has no separate Fortran
reference implementation.

HPottsViz uses **Mulberry32** instead of Fortran's compiler-dependent random
number generator. Equal numeric seeds reproduce a browser run, but do not match
the Fortran graph, cue, momenta or stochastic path. The same network seed builds
the same network across all five browser models. Independent noise, momentum and
hidden seeds do not change the memories or connectivity. The full JSON export
retains the graph, memories, initial state, sampled trajectory, latest probabilities
and final state for completed runs. A stopped run retains its received samples.

## Validation

`npm test` runs scientific checks:

1. Adaptive overlaps, r, thresholds and probabilities match the Fortran trajectory
   from the identical graph and initial state (20 steps, N=250, S=3, p=8).
2. Hidden probabilities, fields, overlaps, extended energy and predicted
   dissipation match the Fortran RK4 trajectory.
3. Conservative states, momenta, overlaps and H match geodesic Verlet; reversing
   momenta retraces the initial state to numerical precision.
4. Equilibrium initial energy and overlaps match Fortran. A specified tangent
   proposal and its Metropolis ratio match an independent NumPy calculation;
   conditional energy and incremental field cache agree with direct evaluation.
5. Repeated seeded noisy trajectories agree and retain positive normalized states.
6. Extended hidden energy decreases in the tested flow; conservative energy error
   decreases at the expected second-order rate under timestep refinement.
7. All parameters have controls; invalid cues, times, Hessians and cancelled
   initializations are rejected before running.
8. The shared network seed constructs identical graphs across models.
9. Activity-only initial kinetic energy is exact and varying it rescales the same
   momentum directions. Tangent forces agree with an independent finite difference
   of F₀. Zero initial K still permits acceleration; probability constraints,
   timestep refinement and time reversal are tested through boundary crossings.
   Its worker reversal and parameter JSON import/export are also exercised.

The committed compressed JSON fixtures are outputs from the matching original HPotts binaries.
Fortran seeds are not used as a claim of stochastic path agreement. Finite-step
Hamiltonian drift is displayed rather than hidden. The adaptive activity energy
is not a Lyapunov function; noisy energy fluctuates; only the hidden **extended**
potential has the continuous-flow dissipation guarantee.
