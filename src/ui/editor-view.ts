/**
 * The editor's screen (PLANO.md §4, screen 2): the preview, with an optional
 * grid; above it, the photo and comparison actions; below it, one tool at a
 * time, the tabs that pick it, and undo and restore.
 *
 * It holds no state of its own: render() draws what the app's state says,
 * and every gesture goes to the app as an event.
 */
import { LENS_PRESETS } from '../core/camera';
import type { CorrectionParams } from '../core/correction';
import type { SliderKey, Tool } from './controls';
import { SLIDERS, TOOLS, presetOf } from './controls';
import type { Locale, Messages } from './i18n';
import { formatMillimetres, formatSlider } from './i18n';

/** What the screen draws. */
export interface EditorViewState {
  readonly params: CorrectionParams;
  readonly tool: Tool;
  readonly grid: boolean;
  readonly comparing: boolean;
  readonly canUndo: boolean;
  /** A photo is opening: the actions wait. */
  readonly busy: boolean;
  /** The line under the preview. */
  readonly status: string;
  /** The focal length the photo's EXIF records, in millimetres. */
  readonly exifFocal: number | null;
}

/** What the screen asks the app for. */
export interface EditorViewEvents {
  /** A slider moved; `done` when it was let go (one change, for undo). */
  slide(key: SliderKey, value: number, done: boolean): void;
  preset(focal35mm: number): void;
  tool(tool: Tool): void;
  undo(): void;
  restore(): void;
  toggleGrid(): void;
  compare(on: boolean): void;
  changePhoto(): void;
}

/** The screen, built once. */
export interface EditorView {
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  render(state: EditorViewState): void;
  /** The control that takes the focus when the screen appears. */
  focusTarget(): HTMLElement;
  /** The control that takes it back after another photo opens. */
  photoButton: HTMLButtonElement;
}

/** An element with a class and, optionally, a text. */
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

/** A button of the given weight (docs/ANGULO.md §4.1). */
function button(weight: 'primario' | 'secundario' | 'discreto', text: string): HTMLButtonElement {
  const node = element('button', `botao ${weight}`, text);
  node.type = 'button';
  return node;
}

/** The grid over the preview: lines at every tenth, light over dark, seen on any photo. */
function gridOverlay(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'grade');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const layer of ['grade-fundo', 'grade-linha']) {
    for (let i = 10; i < 100; i += 10) {
      for (const [x1, y1, x2, y2] of [
        [i, 0, i, 100],
        [0, i, 100, i],
      ]) {
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('class', layer);
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(line);
      }
    }
  }
  return svg;
}

/**
 * Builds the editor's screen.
 *
 * @param t the texts, in the interface's language
 * @param locale how numbers read
 * @param on where gestures go
 */
export function createEditorView(t: Messages, locale: Locale, on: EditorViewEvents): EditorView {
  const root = element('section', 'editor');

  // Above the preview: the photo, the grid, the comparison.
  const photoButton = button('secundario', t.changePhoto);
  photoButton.addEventListener('click', () => on.changePhoto());
  const gridButton = button('discreto', t.grid);
  gridButton.addEventListener('click', () => on.toggleGrid());
  const originalButton = button('discreto', t.showOriginal);
  const hint = element('p', 'so-leitor', t.showOriginalHint);
  hint.id = 'dica-original';
  originalButton.setAttribute('aria-describedby', hint.id);
  const top = element('div', 'editor-topo');
  const topRight = element('div', 'editor-topo-acoes');
  topRight.append(gridButton, originalButton);
  top.append(photoButton, topRight, hint);

  // The preview: held, it shows the original.
  const stage = element('div', 'editor-previa');
  const canvas = element('canvas', 'previa-tela');
  canvas.setAttribute('role', 'img');
  const grid = gridOverlay();
  stage.append(canvas, grid);

  const hold = (target: HTMLElement) => {
    target.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      target.setPointerCapture(event.pointerId);
      on.compare(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      target.addEventListener(type, () => on.compare(false));
    }
    // A long press would otherwise open the browser's menu for the image.
    target.addEventListener('contextmenu', (event) => event.preventDefault());
  };
  hold(stage);
  hold(originalButton);
  originalButton.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      on.compare(true);
    }
  });
  originalButton.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') on.compare(false);
  });
  originalButton.addEventListener('blur', () => on.compare(false));

  // Below: the status, the tool, the tabs, undo and restore.
  const panel = element('div', 'editor-painel');
  const status = element('p', 'apoio');
  status.setAttribute('aria-live', 'polite');

  const toolPanel = element('div', 'ferramenta');
  toolPanel.id = 'painel-ferramenta';
  toolPanel.setAttribute('role', 'tabpanel');

  const sliders = new Map<SliderKey, { input: HTMLInputElement; output: HTMLOutputElement }>();
  const slider = (key: SliderKey): HTMLElement => {
    const box = element('div', 'controle');
    const id = `controle-${key}`;
    const label = element('label', 'rotulo', t.sliders[key]);
    label.htmlFor = id;
    const output = element('output', 'dado');
    output.htmlFor.add(id);
    const input = element('input', 'controle-faixa');
    input.type = 'range';
    input.id = id;
    const { min, max, step } = SLIDERS[key];
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.addEventListener('input', () => on.slide(key, input.valueAsNumber, false));
    input.addEventListener('change', () => on.slide(key, input.valueAsNumber, true));
    const head = element('div', 'controle-topo');
    head.append(label, output);
    box.append(head, input);
    sliders.set(key, { input, output });
    return box;
  };

  const presetButtons = new Map<string, HTMLButtonElement>();
  const presets = element('div', 'lentes');
  presets.setAttribute('role', 'group');
  presets.setAttribute('aria-label', t.lensPresets);
  for (const [name, mm] of Object.entries(LENS_PRESETS)) {
    const preset = button('secundario', name.replace('.', locale === 'en' ? '.' : ','));
    preset.addEventListener('click', () => on.preset(mm));
    presetButtons.set(name, preset);
    presets.append(preset);
  }
  const focalNote = element('p', 'apoio');

  const groups = new Map<Tool, HTMLElement>();
  for (const { tool, sliders: keys } of TOOLS) {
    const group = element('div', 'ferramenta-grupo');
    if (tool === 'lens') group.append(presets);
    for (const key of keys) group.append(slider(key));
    if (tool === 'level') group.append(element('p', 'apoio', t.levelHint));
    if (tool === 'edges') group.append(element('p', 'apoio', t.edgesHint));
    if (tool === 'lens') group.append(focalNote);
    groups.set(tool, group);
    toolPanel.append(group);
  }

  const tabs = element('div', 'abas');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', t.toolsLabel);
  const tabButtons = new Map<Tool, HTMLButtonElement>();
  for (const { tool } of TOOLS) {
    const tab = element('button', 'aba', t.tools[tool]);
    tab.type = 'button';
    tab.id = `aba-${tool}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', toolPanel.id);
    tab.addEventListener('click', () => on.tool(tool));
    tabButtons.set(tool, tab);
    tabs.append(tab);
  }
  // The tabs' keyboard (WAI-ARIA tabs): the arrows move along them, Home and
  // End to the ends, and the tool follows.
  tabs.addEventListener('keydown', (event) => {
    const order = TOOLS.map((entry) => entry.tool);
    const current = order.findIndex((tool) => tabButtons.get(tool) === document.activeElement);
    if (current < 0) return;
    const next = {
      ArrowRight: (current + 1) % order.length,
      ArrowLeft: (current - 1 + order.length) % order.length,
      Home: 0,
      End: order.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    on.tool(order[next]);
    tabButtons.get(order[next])!.focus();
  });

  const undoButton = button('discreto', t.undo);
  undoButton.addEventListener('click', () => on.undo());
  const restoreButton = button('discreto', t.restoreDefaults);
  restoreButton.addEventListener('click', () => on.restore());
  const actions = element('div', 'editor-acoes');
  actions.append(undoButton, restoreButton);

  panel.append(status, toolPanel, tabs, actions);
  root.append(top, stage, panel);

  let shownTool: Tool = 'level';

  return {
    element: root,
    canvas,
    photoButton,
    focusTarget: () => tabButtons.get(shownTool)!,
    render(state: EditorViewState) {
      shownTool = state.tool;
      for (const { tool } of TOOLS) {
        const selected = tool === state.tool;
        const tab = tabButtons.get(tool)!;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        groups.get(tool)!.hidden = !selected;
      }
      toolPanel.setAttribute('aria-labelledby', `aba-${state.tool}`);

      for (const [key, { input, output }] of sliders) {
        const value = state.params[key];
        const text = formatSlider(locale, key, value);
        if (input.valueAsNumber !== value) input.value = String(value);
        input.setAttribute('aria-valuetext', text);
        output.textContent = text;
        input.disabled = state.busy;
      }
      const preset = presetOf(state.params.focal35mm);
      for (const [name, presetButton] of presetButtons) {
        presetButton.setAttribute('aria-pressed', String(name === preset));
        presetButton.disabled = state.busy;
      }
      const { min, max } = SLIDERS.focal35mm;
      focalNote.textContent =
        state.exifFocal === null
          ? t.focalUnknown
          : state.exifFocal < min || state.exifFocal > max
            ? t.focalOutOfRange(
                formatMillimetres(locale, state.exifFocal),
                formatMillimetres(locale, min),
                formatMillimetres(locale, max),
              )
            : t.focalFromPhoto(formatMillimetres(locale, state.exifFocal));

      grid.style.display = state.grid ? '' : 'none';
      gridButton.setAttribute('aria-pressed', String(state.grid));
      originalButton.setAttribute('aria-pressed', String(state.comparing));
      canvas.setAttribute('aria-label', state.comparing ? t.originalLabel : t.previewLabel);

      undoButton.disabled = state.busy || !state.canUndo;
      restoreButton.disabled = state.busy;
      gridButton.disabled = state.busy;
      originalButton.disabled = state.busy;
      photoButton.disabled = state.busy;
      photoButton.textContent = state.busy ? t.opening : t.changePhoto;
      status.textContent = state.status;
    },
  };
}
