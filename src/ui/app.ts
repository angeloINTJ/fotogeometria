/**
 * The app's screens and its state (PLANO.md §4, §5).
 *
 * The state is one immutable object; each change makes a new one and draws
 * the screen from it. Stage 2 of PLANO.md §8 has two screens: the start, with
 * the button that opens a photo, and the preview of the photo corrected with
 * the reference case's fixed parameters.
 */
import { WebGLUnavailableError, Renderer } from '../gl/renderer';
import type { LoadedImage } from '../io/load-image';
import { loadImage } from '../io/load-image';
import { Preview } from './editor';
import type { Messages } from './i18n';
import { referenceParams } from './reference-correction';

/** Why the app could not go on. */
export type AppError = 'decode' | 'webgl' | 'draw';

/** Everything the screen shows. */
export interface AppState {
  readonly screen: 'start' | 'preview';
  /** opening: a photo is being decoded; ready: the preview has drawn it. */
  readonly status: 'idle' | 'opening' | 'ready' | 'error';
  readonly error: AppError | null;
  readonly photo: LoadedImage | null;
}

const INITIAL: AppState = { screen: 'start', status: 'idle', error: null, photo: null };

/** An element of the page, created with a class and, optionally, a text. */
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Builds the app inside `root` and runs it.
 *
 * @param root the page's main element, emptied
 * @param t the texts, in the interface's language
 */
export function startApp(root: HTMLElement, t: Messages): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.hidden = true;

  const start = element('section', 'inicio');
  const choose = element('button', 'botao primario', t.choosePhoto);
  choose.type = 'button';
  const startError = element('p', 'faixa-erro corpo');
  startError.setAttribute('role', 'alert');
  start.append(
    element('h1', 'display', 'FotoGeometria'),
    element('p', 'corpo', t.lead),
    choose,
    element('p', 'apoio', t.privacy),
    startError,
  );

  const preview = element('section', 'previa');
  const canvas = element('canvas', 'previa-tela');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t.previewLabel);
  const status = element('p', 'apoio');
  status.setAttribute('aria-live', 'polite');
  const another = element('button', 'botao secundario', t.chooseAnother);
  another.type = 'button';
  const footer = element('div', 'previa-rodape');
  footer.append(
    element('h1', 'subtitulo', 'FotoGeometria'),
    status,
    element('p', 'apoio', t.fixedCorrection),
    another,
  );
  preview.append(canvas, footer);
  root.replaceChildren(start, preview, input);

  let state = INITIAL;
  let renderer: Renderer | null = null;
  let view: Preview | null = null;
  let startupError: AppError | null = null;
  try {
    renderer = new Renderer(canvas);
    view = new Preview(
      canvas,
      renderer,
      () => {
        if (state.status === 'opening') update({ status: 'ready' });
      },
      (error) => {
        console.error(error);
        update({ screen: 'start', status: 'error', error: 'draw' });
      },
    );
  } catch (error) {
    // No WebGL2 is the browser's; a shader that does not compile is ours.
    if (error instanceof WebGLUnavailableError) {
      startupError = 'webgl';
    } else {
      console.error(error);
      startupError = 'draw';
    }
    renderer = null;
  }

  const errorText: Record<AppError, string> = {
    decode: t.errorDecode,
    webgl: t.errorWebGL,
    draw: t.errorDraw,
  };

  /** Draws the screen from the state. */
  function render(previous: AppState): void {
    root.dataset.screen = state.screen;
    root.dataset.state = state.status;
    start.hidden = state.screen !== 'start';
    preview.hidden = state.screen !== 'preview';
    const opening = state.status === 'opening';
    choose.disabled = opening || renderer === null;
    another.disabled = opening;
    choose.textContent = opening ? t.opening : t.choosePhoto;
    another.textContent = opening ? t.opening : t.chooseAnother;
    startError.hidden = state.error === null;
    startError.textContent = state.error ? errorText[state.error] : '';
    const photo = state.photo;
    if (photo) {
      status.textContent =
        photo.width === photo.originalWidth && photo.height === photo.originalHeight
          ? t.opened(photo.width, photo.height)
          : t.openedReduced(photo.width, photo.height, photo.originalWidth, photo.originalHeight);
    }
    // Focus goes to the button of the screen that appeared, or that is usable
    // again once a photo has opened (a disabled button takes no focus), so
    // the keyboard does not fall back to the top of the page.
    const settled = previous.status === 'opening' && state.status !== 'opening';
    if (state.screen !== previous.screen || settled) {
      const target = state.screen === 'preview' ? another : choose;
      if (!target.disabled) target.focus();
    }
  }

  function update(change: Partial<AppState>): void {
    const previous = state;
    state = { ...state, ...change };
    render(previous);
  }

  async function open(file: File): Promise<void> {
    if (!renderer || !view) return;
    update({ status: 'opening', error: null });
    let photo: LoadedImage;
    try {
      photo = await loadImage(file, renderer.maxTextureSize);
    } catch (error) {
      console.error(error);
      update({ screen: 'start', status: 'error', error: 'decode' });
      return;
    }
    const previous = state.photo;
    // The preview draws in the next frame, and marks the state ready then.
    view.show({ photo, params: referenceParams(photo.width, photo.height) });
    update({ screen: 'preview', photo });
    // The GPU has its own copy now; the old bitmap's memory can go
    // (PLANO.md §6: iOS Safari has little to spare).
    if (previous && previous !== photo) previous.bitmap.close();
  }

  choose.addEventListener('click', () => input.click());
  another.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    // The same file chosen twice must fire change again.
    input.value = '';
    if (file) void open(file);
  });

  if (startupError) {
    update({ status: 'error', error: startupError });
  } else {
    render(INITIAL);
  }
}
