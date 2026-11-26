/**
 * The app's screens and its state (PLANO.md §4, §5).
 *
 * The state is one immutable object; each change makes a new one and draws
 * the screen from it. Two screens: the start, which opens a photo from the
 * gallery or the camera, and the editor (src/ui/editor-view.ts), whose
 * controls change the correction the preview draws.
 */
import { DEFAULT_PARAMS } from '../core/correction';
import type { CorrectionParams } from '../core/correction';
import { WebGLUnavailableError, Renderer } from '../gl/renderer';
import { focal35mmFromExif } from '../io/exif';
import type { LoadedImage } from '../io/load-image';
import { loadImage } from '../io/load-image';
import type { Tool } from './controls';
import { defaultParams, initialParams, withSlider } from './controls';
import { Preview } from './editor';
import { createEditorView } from './editor-view';
import type { History } from './history';
import { remember, undo } from './history';
import type { Locale, Messages } from './i18n';
import { browserStorage, loadPreferences, savePreferences } from './preferences';

/** Why the app could not go on. */
export type AppError = 'decode' | 'webgl' | 'draw';

/** Everything the screen shows. */
export interface AppState {
  readonly screen: 'start' | 'editor';
  /** opening: a photo is being decoded; ready: a photo is open, in the editor. */
  readonly status: 'idle' | 'opening' | 'ready' | 'error';
  readonly error: AppError | null;
  readonly photo: LoadedImage | null;
  /** The focal length the photo's EXIF records, in millimetres. */
  readonly exifFocal: number | null;
  readonly params: CorrectionParams;
  /** The parameters before each change, for undo. */
  readonly history: History;
  readonly tool: Tool;
  readonly grid: boolean;
  /** The original is shown while the preview is held. */
  readonly comparing: boolean;
  /** ?medir: the preview's frames per second with the controls moving. */
  readonly measured: number | 'measuring' | null;
}

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

/** A hidden file input: the gallery, or with `capture`, the camera. */
function fileInput(capture: boolean): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (capture) input.setAttribute('capture', 'environment');
  input.hidden = true;
  return input;
}

/** How long ?medir moves the controls, in seconds. */
export const MEASURE_SECONDS = 3;

/**
 * The parameters of frame `n` of ?medir: Panini and the pitch swing through
 * their ranges, out of step with each other, so every frame is a new
 * correction, as when both sliders are being dragged.
 */
export function measuredParams(base: CorrectionParams, n: number): CorrectionParams {
  return {
    ...base,
    paniniD: 0.5 + 0.5 * Math.sin(n / 10),
    pitchOffsetDeg: 20 * Math.sin(n / 17),
  };
}

/**
 * Builds the app inside `root` and runs it.
 *
 * @param root the page's main element, emptied
 * @param t the texts, in the interface's language
 * @param locale the interface's language, for numbers
 */
export function startApp(root: HTMLElement, t: Messages, locale: Locale): void {
  const gallery = fileInput(false);
  const camera = fileInput(true);
  const storage = browserStorage();
  const preferences = loadPreferences(storage);
  const measureRequested = new URLSearchParams(location.search).has('medir');

  // The start (PLANO.md §4, screen 1).
  const start = element('section', 'inicio');
  const choose = element('button', 'botao primario', t.choosePhoto);
  choose.type = 'button';
  const take = element('button', 'botao secundario', t.takePhoto);
  take.type = 'button';
  const startActions = element('div', 'inicio-acoes');
  startActions.append(choose, take);
  const startError = element('p', 'faixa-erro corpo');
  startError.setAttribute('role', 'alert');
  start.append(
    element('h1', 'display', 'FotoGeometria'),
    element('p', 'corpo', t.lead),
    startActions,
    element('p', 'apoio', t.privacy),
    startError,
  );

  let state: AppState = {
    screen: 'start',
    status: 'idle',
    error: null,
    photo: null,
    exifFocal: null,
    params: DEFAULT_PARAMS,
    history: [],
    tool: 'level',
    grid: preferences.grid ?? false,
    comparing: false,
    measured: null,
  };
  // The parameters a slider started from, while it is being dragged.
  let dragFrom: CorrectionParams | null = null;

  const editor = createEditorView(t, locale, {
    slide(key, value, done) {
      if (!state.photo) return;
      dragFrom ??= state.params;
      const params = withSlider(state.params, key, value);
      if (!done) {
        update({ params });
        return;
      }
      update({ params, history: remember(state.history, dragFrom, params) });
      dragFrom = null;
      keep();
    },
    preset(focal35mm) {
      change(withSlider(state.params, 'focal35mm', focal35mm));
    },
    tool(tool) {
      update({ tool });
    },
    undo() {
      const back = undo(state.history);
      if (!back) return;
      update({ params: back.params, history: back.history });
      keep();
    },
    restore() {
      change(defaultParams(state.exifFocal));
      keep();
    },
    toggleGrid() {
      update({ grid: !state.grid });
      keep();
    },
    compare(on) {
      if (state.photo && state.comparing !== on) update({ comparing: on });
    },
    changePhoto() {
      gallery.click();
    },
  });
  editor.element.hidden = true;
  root.replaceChildren(start, editor.element, gallery, camera);

  let renderer: Renderer | null = null;
  let preview: Preview | null = null;
  let startupError: AppError | null = null;
  try {
    renderer = new Renderer(editor.canvas);
    preview = new Preview(editor.canvas, renderer, (error) => {
      console.error(error);
      update({ screen: 'start', status: 'error', error: 'draw' });
    });
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

  /** A committed change of the parameters: one step for undo. */
  function change(params: CorrectionParams): void {
    update({ params, history: remember(state.history, state.params, params) });
  }

  /** Keeps what outlives the photo (src/ui/preferences.ts). */
  function keep(): void {
    savePreferences(storage, {
      paniniD: state.params.paniniD,
      verticalCompression: state.params.verticalCompression,
      grid: state.grid,
    });
  }

  /** The line under the preview. */
  function statusLine(): string {
    if (state.measured === 'measuring') return t.measuring;
    if (typeof state.measured === 'number') return t.measured(Math.round(state.measured));
    const photo = state.photo;
    if (!photo) return '';
    return photo.width === photo.originalWidth && photo.height === photo.originalHeight
      ? t.opened(photo.width, photo.height)
      : t.openedReduced(photo.width, photo.height, photo.originalWidth, photo.originalHeight);
  }

  /** Draws the screen from the state. */
  function render(previous: AppState): void {
    root.dataset.screen = state.screen;
    root.dataset.state = state.status;
    start.hidden = state.screen !== 'start';
    editor.element.hidden = state.screen !== 'editor';
    const opening = state.status === 'opening';
    choose.disabled = opening || renderer === null;
    take.disabled = opening || renderer === null;
    choose.textContent = opening ? t.opening : t.choosePhoto;
    startError.hidden = state.error === null;
    startError.textContent = state.error ? errorText[state.error] : '';

    editor.render({
      params: state.params,
      tool: state.tool,
      grid: state.grid,
      comparing: state.comparing,
      canUndo: state.history.length > 0,
      busy: opening || state.measured === 'measuring',
      status: statusLine(),
      exifFocal: state.exifFocal,
    });
    if (state.photo && state.screen === 'editor') {
      preview?.show({
        photo: state.photo,
        params: state.params,
        mode: state.comparing ? 'original' : 'corrected',
      });
    }

    // Focus goes where the keyboard can go on: to the tools when the editor
    // appears, back to the photo button when another photo has opened, to
    // the start's button when the start comes back. A disabled control takes
    // no focus, so it waits for the photo to open.
    const settled = previous.status === 'opening' && state.status !== 'opening';
    if (state.screen !== previous.screen || settled) {
      const target =
        state.screen === 'start'
          ? choose
          : state.screen !== previous.screen
            ? editor.focusTarget()
            : editor.photoButton;
      if (!(target instanceof HTMLButtonElement && target.disabled)) target.focus();
    }
  }

  function update(change: Partial<AppState>): void {
    const previous = state;
    state = { ...state, ...change };
    render(previous);
  }

  /** ?medir: moves the controls for a few seconds and reports the frames per second. */
  async function measure(): Promise<void> {
    if (!preview) return;
    update({ measured: 'measuring' });
    const base = state.params;
    try {
      const fps = await preview.measure((n) => measuredParams(base, n), MEASURE_SECONDS);
      update({ measured: fps });
    } catch (error) {
      console.error(error);
      update({ measured: null });
    }
  }

  async function open(file: File): Promise<void> {
    if (!renderer || !preview) return;
    update({ status: 'opening', error: null, comparing: false });
    const exif = focal35mmFromExif(file);
    let photo: LoadedImage;
    try {
      photo = await loadImage(file, renderer.maxTextureSize);
    } catch (error) {
      console.error(error);
      update({ screen: 'start', status: 'error', error: 'decode' });
      return;
    }
    const exifFocal = await exif;
    const previous = state.photo;
    // Ready once the photo is decoded and handed to the GPU (render() shows
    // it): the preview draws it in the next frame. Waiting for that frame
    // would leave the buttons disabled for good if the context were lost
    // then and never given back.
    update({
      screen: 'editor',
      status: 'ready',
      photo,
      exifFocal,
      params: initialParams(loadPreferences(storage), exifFocal),
      history: [],
      measured: null,
    });
    // The GPU has its own copy now; the old bitmap's memory can go
    // (PLANO.md §6: iOS Safari has little to spare).
    if (previous && previous !== photo) previous.bitmap.close();
    if (measureRequested) void measure();
  }

  choose.addEventListener('click', () => gallery.click());
  take.addEventListener('click', () => camera.click());
  for (const input of [gallery, camera]) {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      // The same file chosen twice must fire change again.
      input.value = '';
      if (file) void open(file);
    });
  }

  if (startupError) {
    update({ status: 'error', error: startupError });
  } else {
    render(state);
  }
}
