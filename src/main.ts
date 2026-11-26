/**
 * Entry point of the app.
 *
 * Stage 0 of PLANO.md §8 only wires the interface standard: the Ângulo tokens,
 * the app's own styles and a theme that follows the device.
 */
import './styles/angulo.css';
import './styles/app.css';

const dark = matchMedia('(prefers-color-scheme: dark)');
dark.addEventListener('change', (event) => {
  document.documentElement.dataset.theme = event.matches ? 'escuro' : 'claro';
});
