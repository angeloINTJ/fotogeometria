/**
 * The preview: a canvas that shows the corrected photo whole, fitted, at the
 * screen's own resolution, and draws again when its size changes or the GPU
 * gives the context back.
 */
import type { Correction, CorrectionParams } from '../core/correction';
import { buildProjection } from '../core/correction';
import type { LoadedImage } from '../io/load-image';
import type { Renderer } from '../gl/renderer';
import { fitView, reprojectionUniforms } from '../gl/uniforms';

/** What the preview shows: a photo, corrected with these parameters. */
export interface PreviewContent {
  readonly photo: LoadedImage;
  readonly params: CorrectionParams;
}

/** Draws a correction on a canvas, once per frame at most. */
export class Preview {
  private content: PreviewContent | null = null;
  private correction: Correction | null = null;
  private frame = 0;

  /**
   * @param onDrawn called after each frame that drew the photo
   * @param onError called with what a frame threw; the preview stops drawing
   */
  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly renderer: Renderer,
    private readonly onDrawn: () => void,
    private readonly onError: (error: unknown) => void,
  ) {
    new ResizeObserver(() => this.schedule()).observe(canvas);
    renderer.onRestored = () => this.schedule();
  }

  /** Shows a photo, or nothing. The photo's bitmap becomes the GPU's source. */
  show(content: PreviewContent | null): void {
    if (content && content.photo !== this.content?.photo) {
      this.renderer.setSource(content.photo.bitmap);
    }
    if (content?.photo !== this.content?.photo || content?.params !== this.content?.params) {
      this.correction = null;
    }
    this.content = content;
    this.schedule();
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      try {
        if (this.draw()) this.onDrawn();
      } catch (error) {
        this.content = null;
        this.onError(error);
      }
    });
  }

  /** Draws the current content; false when there is nothing to draw yet. */
  private draw(): boolean {
    const { canvas, renderer, content } = this;
    if (!content || renderer.isLost) return false;
    // The drawing buffer gets one pixel per device pixel of the canvas's box,
    // up to what the GPU renders in one pass, both sides by the same factor:
    // a buffer of another proportion than its box would be shown stretched.
    const boxWidth = canvas.clientWidth * (window.devicePixelRatio || 1);
    const boxHeight = canvas.clientHeight * (window.devicePixelRatio || 1);
    const fit = Math.min(1, renderer.maxRenderSize / Math.max(boxWidth, boxHeight));
    const width = Math.round(boxWidth * fit);
    const height = Math.round(boxHeight * fit);
    if (width < 1 || height < 1) return false;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    this.correction ??= buildProjection(content.params, content.photo.width, content.photo.height);
    const { framing } = this.correction;
    const view = fitView(
      { x: 0, y: 0, width: framing.width, height: framing.height },
      width,
      height,
    );
    renderer.draw(reprojectionUniforms(this.correction, view));
    return true;
  }
}
