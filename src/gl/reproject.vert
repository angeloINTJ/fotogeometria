#version 300 es
// One triangle that covers the viewport; the fragment shader does the work.
// Drawn with gl.drawArrays(gl.TRIANGLES, 0, 3) and no vertex buffer.
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
