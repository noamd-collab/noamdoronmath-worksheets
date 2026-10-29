import { createContext, runInContext, runInNewContext } from 'node:vm';

// These extracted-function suites test the visual compiler/source-safety
// contract under an explicitly permitted worksheet. Product eligibility is
// tested with the real policy and real manifests in ramzi-visual-policy-viewer.
// Keeping that dependency explicit preserves the older compiler counterexamples
// without claiming that arithmetic/statistics pages may display those results.
const installed = new WeakSet<object>();
function compilerEligibility(context: any = {}) {
  if (installed.has(context)) return context;
  installed.add(context);
  context.noamVisualsAllowed ??= () => true;
  context.noamInterceptBlockedDrawing ??= () => false;
  const exercise = context.selectedExercise || context.manifest?.exercises?.[0] || context.exercise;
  const match = /^G([789])-(T\d{2})-/.exec(String(exercise?.id || ''));
  if (!Object.hasOwn(context, 'manifest')) context.manifest = {};
  if (context.manifest) {
    context.manifest.grade ??= match ? Number(match[1]) : Number(context.g) || 7;
    context.manifest.prefix ??= match ? `G${match[1]}-${match[2]}` : 'G7-T11';
  }
  if (!Object.hasOwn(context, 'selectedExercise')) {
    context.selectedExercise = exercise || { id: 'G7-T11-A-Q01א' };
  }
  return context;
}

export function runVisualCompilerInNewContext(code: string, context: any = {}, options?: any) {
  return runInNewContext(code, compilerEligibility(context), options);
}

export function createVisualCompilerContext(context: any = {}, options?: any) {
  return createContext(compilerEligibility(context), options);
}

export function runVisualCompilerInContext(code: string, context: any, options?: any) {
  return runInContext(code, compilerEligibility(context), options);
}
