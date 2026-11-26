/**
 * Entry point of the app: the Ângulo tokens and the app's styles, a theme
 * that follows the device, the interface's language, and the screens.
 */
import './styles/angulo.css';
import './styles/app.css';
import { startApp } from './ui/app';
import { MESSAGES, pickLocale } from './ui/i18n';

const dark = matchMedia('(prefers-color-scheme: dark)');
dark.addEventListener('change', (event) => {
  document.documentElement.dataset.theme = event.matches ? 'escuro' : 'claro';
});

const locale = pickLocale(navigator.languages);
document.documentElement.lang = locale;
startApp(document.getElementById('app')!, MESSAGES[locale], locale);
