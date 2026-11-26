/**
 * The preview: a canvas that shows the corrected photo whole, fitted, at the
 * screen's own resolution, or the original photo the same way for the
 * comparison (PLANO.md §4: holding the preview shows the original). It draws
 * again when what it shows changes, when its size changes, and when the GPU
 * gives the context back.
 */
import type { Correction, CorrectionParams } from '../core/correction';
import { buildProjection } from '../core/correction';
import type { LoadedImage } from '../io/load-image';
import type { Renderer } from '../gl/renderer';
import { fitView, reprojectionUniforms } from '../gl/uniforms';

/** What the preview shows: a photo, corrected with these parameters, or not. */
export interface PreviewContent {
  readonly photo: LoadedImage;
  readonly params: CorrectionParams;
  /** 'original' shows the photo as it came, fitted the same way. */
  readonly mode: 'corrected' | 'original';
}

/** Draws a correction on a canvas, once per frame at most. */
export class Preview {
  private content: PreviewContent | null = null;
  private correction: Correction | null = null;
  private frame = 0;
  private frames = 0;

  /**
   * @param onError called with what a frame threw; the preview stops drawing
   */
  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly renderer: Renderer,
    private readonly onError: (error: unknown) => void,
  ) {
    new ResizeObserver(() => this.schedule()).observe(canvas);
    renderer.onRestored = () => this.schedule();
  }

  /**
   * Shows a photo, or nothing, drawn in the next frame. The photo's bitmap
   * becomes the GPU's source; the correction is built again only when the
   * photo or the parameters changed.
   */
  show(content: PreviewContent | null): void {
    if (content && content.photo !== this.content?.photo) {
      this.renderer.setSource(content.photo.bitmap);
    }
    if (content?.photo !== this.content?.photo || content?.params !== this.content?.params) {
      this.correction = null;
    }
    const changed =
      content?.photo !== this.content?.photo ||
      content?.params !== this.content?.params ||
      content?.mode !== this.content?.mode;
    this.content = content;
    if (changed) this.schedule();
  }

  /**
   * How many frames the preview has drawn: ?medir counts them over a few
   * seconds (src/ui/app.ts). A frame skipped, for a lost context or an empty
   * box, is not one.
   */
  get drawn(): number {
    return this.frames;
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      try {
        this.draw();
      } catch (error) {
        this.content = null;
        this.onError(error);
      }
    });
  }

  /**
   * Draws the current content, when there is any and the GPU can: a lost
   * context draws again once the browser gives it back (onRestored).
   */
  private draw(): void {
    const { canvas, renderer, content } = this;
    if (!content || renderer.isLost) return;
    // The drawing buffer gets one pixel per device pixel of the canvas's box,
    // up to what the GPU renders in one pass, both sides by the same factor:
    // a buffer of another proportion than its box would be shown stretched.
    const boxWidth = canvas.clientWidth * (window.devicePixelRatio || 1);
    const boxHeight = canvas.clientHeight * (window.devicePixelRatio || 1);
    const fit = Math.min(1, renderer.maxRenderSize / Math.max(boxWidth, boxHeight));
    const width = Math.round(boxWidth * fit);
    const height = Math.round(boxHeight * fit);
    if (width < 1 || height < 1) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const { photo, params, mode } = content;
    this.correction ??= buildProjection(params, photo.width, photo.height);
    // The original fills the view by its own size; the correction by its framing.
    const region =
      mode === 'original'
        ? { x: 0, y: 0, width: photo.width, height: photo.height }
        : {
            x: 0,
            y: 0,
            width: this.correction.framing.width,
            height: this.correction.framing.height,
          };
    renderer.draw(
      reprojectionUniforms(this.correction, fitView(region, width, height), {
        mode: mode === 'original' ? 'original' : 'color',
      }),
    );
    this.frames++;
  }
}
