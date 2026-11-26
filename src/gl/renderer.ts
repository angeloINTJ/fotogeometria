/**
 * The WebGL2 side of the reprojection: one program, one source texture, and
 * two ways to draw it, to the canvas (the preview) or to a framebuffer that is
 * read back (the export, the tests).
 *
 * It owns no mathematics: every number arrives as a ReprojectionUniforms built
 * by src/gl/uniforms.ts from src/core.
 */
import fragmentSource from './reproject.frag?raw';
import vertexSource from './reproject.vert?raw';
import type { ReprojectionUniforms } from './uniforms';

/** The browser has no WebGL2, or refused a context. */
export class WebGLUnavailableError extends Error {
  constructor() {
    super('WebGL2 is not available');
    this.name = 'WebGLUnavailableError';
  }
}

/** Pixels read back from a framebuffer, top row first. */
export interface ReadBack<T extends Uint8Array | Float32Array> {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, top row first. */
  readonly data: T;
}

/**
 * The rows of an RGBA read-back in the opposite order: gl.readPixels starts
 * at the bottom of the window, where output row H - 1 is drawn.
 */
export function topRowFirst<T extends Uint8Array | Float32Array>(
  data: T,
  width: number,
  height: number,
): T {
  const stride = width * 4;
  const out = data.slice();
  for (let y = 0; y < height; y++) {
    out.set(data.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
  }
  return out as T;
}

const UNIFORMS = [
  'uSource',
  'uColumns',
  'uRows',
  'uSourceSize',
  'uFocal',
  'uCenter',
  'uRotation',
  'uViewOrigin',
  'uViewScale',
  'uTargetHeight',
  'uRegion',
  'uMargin',
  'uMode',
] as const;

type UniformName = (typeof UNIFORMS)[number];

/** Draws the reprojection with WebGL2. */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private texture: WebGLTexture | null = null;
  private source: TexImageSource | null = null;
  // The per-column and per-row tables (src/gl/uniforms.ts), and the arrays
  // they hold, so a redraw with the same view uploads nothing.
  private columns: WebGLTexture | null = null;
  private rows: WebGLTexture | null = null;
  private uploaded: { columns: Float32Array; rows: Float32Array } | null = null;
  private locations = new Map<UniformName, WebGLUniformLocation | null>();
  private lost = false;

  /** The largest texture side this GPU takes (PLANO.md §6: 4096 on some phones). */
  readonly maxTextureSize: number;
  /**
   * The largest side of a target this GPU renders in one pass: a framebuffer,
   * and the tables, which are textures one target side long.
   */
  readonly maxRenderSize: number;
  /** Called after the context was lost and rebuilt; the caller redraws. */
  onRestored: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new WebGLUnavailableError();
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    this.maxRenderSize = Math.min(
      this.maxTextureSize,
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
      viewport[0] ?? 0,
      viewport[1] ?? 0,
    );
    // PLANO.md §6: a lost context (the GPU reset, the tab went to the
    // background on a phone) is rebuilt, with the same source, and redrawn.
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.locations.clear();
      this.texture = null;
      this.columns = null;
      this.rows = null;
      this.uploaded = null;
      this.init();
      if (this.source) this.setSource(this.source);
      this.onRestored?.();
    });
    this.init();
  }

  /** Whether the context is lost right now; drawing is skipped until it returns. */
  get isLost(): boolean {
    return this.lost || this.gl.isContextLost();
  }

  private init(): void {
    const gl = this.gl;
    const compile = (type: number, text: string): WebGLShader => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        throw new Error(`shader: ${gl.getShaderInfoLog(shader) ?? 'unknown error'}`);
      }
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`program: ${gl.getProgramInfoLog(program) ?? 'unknown error'}`);
    }
    this.program = program;
    for (const name of UNIFORMS) this.locations.set(name, gl.getUniformLocation(program, name));
    this.vao = gl.createVertexArray();
  }

  /**
   * Uploads the photo as the source texture, with mipmaps and trilinear
   * filtering: where the correction shrinks the photo, sampling the base level
   * alone would alias (PLANO.md §6).
   */
  setSource(source: TexImageSource): void {
    this.source = source;
    if (this.isLost) return;
    const gl = this.gl;
    if (!this.texture) this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
    if (anisotropic) {
      const max = gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
      gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
    }
  }

  /**
   * A one-row float texture for a table. Read with texelFetch, never
   * filtered: NEAREST also keeps it complete without mipmaps, and an
   * incomplete texture reads as zeros.
   */
  private createTable(): WebGLTexture {
    const gl = this.gl;
    const table = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, table);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return table;
  }

  /** Uploads the tables of these uniforms, unless they are the ones already there. */
  private uploadTables(u: ReprojectionUniforms): void {
    if (this.uploaded?.columns === u.columns && this.uploaded.rows === u.rows) return;
    const gl = this.gl;
    this.columns ??= this.createTable();
    this.rows ??= this.createTable();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.bindTexture(gl.TEXTURE_2D, this.columns);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, u.targetWidth, 1, 0, gl.RGBA, gl.FLOAT, u.columns);
    gl.bindTexture(gl.TEXTURE_2D, this.rows);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, u.targetHeight, 1, 0, gl.RED, gl.FLOAT, u.rows);
    this.uploaded = { columns: u.columns, rows: u.rows };
  }

  private apply(u: ReprojectionUniforms): void {
    const gl = this.gl;
    const at = (name: UniformName) => this.locations.get(name) ?? null;
    this.uploadTables(u);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.columns);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.rows);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(at('uSource'), 0);
    gl.uniform1i(at('uColumns'), 1);
    gl.uniform1i(at('uRows'), 2);
    gl.uniform2f(at('uSourceSize'), u.sourceSize[0], u.sourceSize[1]);
    gl.uniform1f(at('uFocal'), u.focal);
    gl.uniform2f(at('uCenter'), u.center[0], u.center[1]);
    gl.uniformMatrix3fv(at('uRotation'), false, u.rotation);
    gl.uniform2f(at('uViewOrigin'), u.viewOrigin[0], u.viewOrigin[1]);
    gl.uniform1f(at('uViewScale'), u.viewScale);
    gl.uniform1i(at('uTargetHeight'), u.targetHeight);
    gl.uniform4f(at('uRegion'), u.region[0], u.region[1], u.region[2], u.region[3]);
    gl.uniform1f(at('uMargin'), u.margin);
    gl.uniform1i(at('uMode'), u.mode);
  }

  /**
   * Draws to the canvas, whose drawing buffer must already have the size the
   * uniforms' view was built for.
   */
  draw(u: ReprojectionUniforms): void {
    if (this.isLost || !this.texture) return;
    if (u.targetWidth !== this.canvas.width || u.targetHeight !== this.canvas.height) {
      // The tables have one entry per target pixel: drawn into another size,
      // the picture would be read from the wrong entries.
      throw new RangeError(
        `uniforms for ${u.targetWidth}x${u.targetHeight}, canvas of ${this.canvas.width}x${this.canvas.height}`,
      );
    }
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.apply(u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Draws into an offscreen framebuffer and reads it back, top row first.
   *
   * The framebuffer is drawn the way the canvas is, output row j at window
   * row H - 1 - j (reproject.frag says why), and gl.readPixels returns window
   * rows from the bottom, so the rows come back in the output's order.
   *
   * @param kind 'rgba8' for colour; 'float' for the coordinates mode, which
   *   needs EXT_color_buffer_float
   */
  readPixels(
    u: ReprojectionUniforms,
    width: number,
    height: number,
    kind: 'rgba8',
  ): ReadBack<Uint8Array>;
  readPixels(
    u: ReprojectionUniforms,
    width: number,
    height: number,
    kind: 'float',
  ): ReadBack<Float32Array>;
  readPixels(
    u: ReprojectionUniforms,
    width: number,
    height: number,
    kind: 'rgba8' | 'float',
  ): ReadBack<Uint8Array> | ReadBack<Float32Array> {
    if (this.isLost) throw new Error('the WebGL context is lost');
    if (width > this.maxRenderSize || height > this.maxRenderSize) {
      throw new RangeError(`${width}x${height} is past this GPU's ${this.maxRenderSize} px`);
    }
    if (u.targetWidth !== width || u.targetHeight !== height) {
      throw new RangeError(
        `uniforms for ${u.targetWidth}x${u.targetHeight}, not ${width}x${height}`,
      );
    }
    const gl = this.gl;
    if (kind === 'float' && !gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('EXT_color_buffer_float is not available');
    }
    const target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target);
    if (kind === 'float') {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    try {
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.apply(u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (kind === 'float') {
        const data = new Float32Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, data);
        return { width, height, data: topRowFirst(data, width, height) };
      }
      const data = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return { width, height, data: topRowFirst(data, width, height) };
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(target);
    }
  }

  /** Releases the GPU's memory (PLANO.md §6: iOS Safari has little to spare). */
  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteTexture(this.columns);
    gl.deleteTexture(this.rows);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    this.texture = null;
    this.columns = null;
    this.rows = null;
    this.uploaded = null;
    this.source = null;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
