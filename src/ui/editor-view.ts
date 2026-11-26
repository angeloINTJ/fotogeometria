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
import type { FocalReading } from '../io/exif';
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
  /** A photo is opening: the photo button says so. */
  readonly opening: boolean;
  /** A photo is opening, or ?medir is measuring: the controls wait. */
  readonly busy: boolean;
  /** The line under the preview. */
  readonly status: string;
  /** What the photo's EXIF says about its focal length. */
  readonly focal: FocalReading;
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

/**
 * Sets a text, or an attribute, only when it changes. A screen reader can
 * announce a live region again when its text is merely rewritten, and the
 * editor draws on every frame a slider moves.
 */
function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function setAttribute(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
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
  // The screen's title, for screen readers: the preview needs the room.
  const title = element('h1', 'so-leitor', 'FotoGeometria');

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

  // The hold follows the pointer that began it: a second finger lifted
  // elsewhere does not end it.
  const hold = (target: HTMLElement) => {
    let holding: number | null = null;
    target.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || holding !== null) return;
      holding = event.pointerId;
      target.setPointerCapture(event.pointerId);
      on.compare(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      target.addEventListener(type, (event) => {
        if (event.pointerId !== holding) return;
        holding = null;
        on.compare(false);
      });
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

  const sliders = new Map<SliderKey, { input: HTMLInputElement; value: HTMLElement }>();
  const slider = (key: SliderKey): HTMLElement => {
    const box = element('div', 'controle');
    const id = `controle-${key}`;
    const label = element('label', 'rotulo', t.sliders[key]);
    label.htmlFor = id;
    // The value as the eye reads it; a screen reader hears the slider's own
    // aria-valuetext, so this one is hidden from it, not announced twice.
    const value = element('span', 'dado');
    value.setAttribute('aria-hidden', 'true');
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
    head.append(label, value);
    box.append(head, input);
    sliders.set(key, { input, value });
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
  root.append(title, top, stage, panel);

  let shownTool: Tool = 'level';

  /** What the lens tool says about the photo's own focal length. */
  const focalText = (focal: FocalReading): string => {
    if (focal.kind === 'none') return t.focalNone;
    if (focal.kind === 'unreadable') return t.focalUnreadable;
    const { min, max } = SLIDERS.focal35mm;
    const mm = formatMillimetres(locale, focal.mm);
    return focal.mm < min || focal.mm > max
      ? t.focalOutOfRange(mm, formatMillimetres(locale, min), formatMillimetres(locale, max))
      : t.focalFromPhoto(mm);
  };

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
        setAttribute(tab, 'aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        groups.get(tool)!.hidden = !selected;
      }
      setAttribute(toolPanel, 'aria-labelledby', `aba-${state.tool}`);

      for (const [key, { input, value }] of sliders) {
        const current = state.params[key];
        const text = formatSlider(locale, key, current);
        if (input.valueAsNumber !== current) input.value = String(current);
        setAttribute(input, 'aria-valuetext', text);
        setText(value, text);
        input.disabled = state.busy;
      }
      const preset = presetOf(state.params.focal35mm);
      for (const [name, presetButton] of presetButtons) {
        setAttribute(presetButton, 'aria-pressed', String(name === preset));
        presetButton.disabled = state.busy;
      }
      setText(focalNote, focalText(state.focal));

      grid.style.display = state.grid ? '' : 'none';
      setAttribute(gridButton, 'aria-pressed', String(state.grid));
      setAttribute(originalButton, 'aria-pressed', String(state.comparing));
      setAttribute(canvas, 'aria-label', state.comparing ? t.originalLabel : t.previewLabel);

      undoButton.disabled = state.busy || !state.canUndo;
      restoreButton.disabled = state.busy;
      gridButton.disabled = state.busy;
      originalButton.disabled = state.busy;
      photoButton.disabled = state.busy;
      setText(photoButton, state.opening ? t.opening : t.changePhoto);
      setText(status, state.status);
    },
  };
}
