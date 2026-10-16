# HPottsViz

Four interactive Potts memory models, in the white, purple and pastel-panel style
of [PottsViz](https://pottsviz.vercel.app). Live overlapping-memory trajectories,
energy diagnostics, memory heatmap, 250-unit state grid and threshold projections.

- Adaptive Potts: synchronous Euler with sigma-driven adaptation.
- Equilibrium noise: the flat-simplex Gibbs sampler using two sphere coordinates
  per category, tangent Langevin proposals and Metropolis correction.
- Conservative Hamiltonian: signed sphere amplitudes, tangent activity momenta,
  threshold momenta and geodesic Verlet; optional full time-reversal check.
- Hidden-variable relaxation: direct sigma-space RK4, reciprocal quadratic
  hidden fields and all four hidden initialization modes.

The deterministic non-adaptive reference is not a fifth UI model. Every namelist
parameter for the four selected models is editable except network size, fixed
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
All four models display their key equations below their subtitles. The final
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
geometry and integrators follow that code.

HPottsViz uses **Mulberry32** instead of Fortran's compiler-dependent random
number generator. Equal numeric seeds reproduce a browser run, but do not match
the Fortran graph, cue, momenta or stochastic path. The same network seed builds
the same network across all four browser models. Independent noise, momentum and
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

The committed compressed JSON fixtures are outputs from the matching original HPotts binaries.
Fortran seeds are not used as a claim of stochastic path agreement. Finite-step
Hamiltonian drift is displayed rather than hidden. The adaptive activity energy
is not a Lyapunov function; noisy energy fluctuates; only the hidden **extended**
potential has the continuous-flow dissipation guarantee.
