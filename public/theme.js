// The theme follows the device (PLANO.md §4, docs/ANGULO.md §5.2).
//
// A classic script, loaded in <head> before the body is parsed, so the first
// paint already has the right theme: a module script runs after parsing, and
// the page would flash light before turning dark. src/main.ts keeps following
// the device after load.
document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches
  ? 'escuro'
  : 'claro';
