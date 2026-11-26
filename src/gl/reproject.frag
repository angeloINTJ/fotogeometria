#version 300 es
// The reprojection of PLANO.md §3.6, one output pixel per fragment.
//
// Steps 1 to 3 (the plane coordinates, the vertical expansion and the inverse
// Panini) depend on the output column or on the output row alone, so
// src/gl/uniforms.ts computes them with src/core's own functions, in double
// precision, as two tables: one entry per target column, one per target row.
// This shader does steps 4 to 7: the rotation, the depth test, the division
// and the sampling.
//
// Why tables: GLSL leaves the precision of sin, cos and tan to the GPU, and
// the Vulkan rules, which SwiftShader follows, allow sin and cos an absolute
// error of 2^-11 and derive tan from them. On 2026-11-26, steps 1 to 3
// evaluated here put the sampled source up to 0.139 px from the reference's
// (the reference case, Chrome 158 on SwiftShader); the plan asks for 0.01.
// What is left here is sums, products, a square root and divisions, which
// every GPU must round to a few ulps. docs/DECISIONS.md has the record.
//
// highp everywhere: at mediump a source coordinate of 4000 px keeps about
// 2 px of precision (PLANO.md §6).
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uSource;
uniform sampler2D uColumns; // texel (i, 0): sin lon, cos lon, 1 / S of target column i
uniform sampler2D uRows;    // texel (j, 0): the expanded y of target row j, top-down
uniform vec2 uSourceSize;   // W, H of the source, in pixels
uniform float uFocal;       // f, pixels per unit of the output plane
uniform vec2 uCenter;       // cx, cy
uniform mat3 uRotation;     // corrected-camera rays to source-camera rays
uniform vec2 uViewOrigin;   // output coordinate of the target's top-left corner
uniform float uViewScale;   // output pixels per target pixel
uniform int uTargetHeight;  // target height in pixels, to turn gl_FragCoord top-down
uniform vec4 uRegion;       // x, y, width, height in output pixels; outside is empty
uniform float uMargin;      // a source position this close to the edge is invalid
uniform int uMode;          // 0 colour, 1 source coordinates (u, v, valid, 1), 2 original

out vec4 outColor;

const float MIN_DEPTH = 1e-6; // src/core/camera.ts

void main() {
  // gl_FragCoord.xy is the centre of window pixel (i, w), counted from the
  // bottom: (i + 0.5, w + 0.5). Output row j is drawn at window row
  // H - 1 - j, in a framebuffer as on the canvas: the GPU takes the
  // derivatives that pick the mipmap level per 2 x 2 block of pixels, so a
  // framebuffer drawn the other way up filters some edges differently (978
  // bytes of the reference case, by up to 23 levels, on 2026-11-26). One
  // orientation makes the preview and a read-back the same draw.
  ivec2 pixel = ivec2(gl_FragCoord.xy);
  int row = uTargetHeight - 1 - pixel.y;
  // The output coordinate of this pixel's centre, as uniforms.ts computes it.
  vec2 q = uViewOrigin + (vec2(pixel.x, row) + 0.5) * uViewScale;
  bool shown = q.x >= uRegion.x && q.y >= uRegion.y &&
               q.x <= uRegion.x + uRegion.z && q.y <= uRegion.y + uRegion.w;

  vec3 column = texelFetch(uColumns, ivec2(pixel.x, 0), 0).xyz;
  float y = texelFetch(uRows, ivec2(row, 0), 0).x;
  // The ray of src/core's sourcePoint, up to its length (paniniColumn).
  vec3 ray = vec3(column.x, y * column.z, column.y);
  vec3 r = uRotation * ray;
  // The reference tests the depth of the unit ray: r.z / |ray| > MIN_DEPTH.
  // Mode 2 draws the original photo, fitted in the same view: the before of
  // before/after.
  bool front = uMode == 2 || r.z > MIN_DEPTH * length(ray);
  vec2 uv = uMode == 2 ? q - 0.5 : uFocal * r.xy / r.z + uCenter;
  bool inside = front && uv.x >= uMargin && uv.y >= uMargin &&
                uv.x <= uSourceSize.x - 1.0 - uMargin && uv.y <= uSourceSize.y - 1.0 - uMargin;

  // Every fragment samples, before any branch: the mipmap level comes from
  // how uv changes between neighbouring fragments, and GLSL leaves that
  // undefined where neighbours took different branches. Texel i has its
  // centre at (i + 0.5) / size.
  vec4 texel = texture(uSource, (uv + 0.5) / uSourceSize);

  if (!shown) {
    outColor = vec4(0.0);
  } else if (uMode == 1) {
    outColor = front ? vec4(uv, inside ? 1.0 : 0.0, 1.0) : vec4(-1.0, -1.0, 0.0, 1.0);
  } else {
    outColor = inside ? vec4(texel.rgb, 1.0) : vec4(0.0);
  }
}
