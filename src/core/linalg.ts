/**
 * Vectors and 3x3 matrices: the little linear algebra the correction needs.
 *
 * Everything is a plain readonly tuple, so a value can be shared between the
 * editor's immutable state, the shader's uniforms and the tests without being
 * copied or mutated. Matrices are row-major: m[3 * row + col].
 */

/** A vector of three numbers. */
export type Vec3 = readonly [number, number, number];

/** A 3x3 matrix, row-major: `m[3 * row + col]`. */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** The identity matrix. */
export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Dot product. */
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Cross product a × b. */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Euclidean norm. */
export function norm(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

/** The vector times a scalar. */
export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

/** a - b. */
export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * The unit vector along `a`. Divides by the norm the way NumPy does
 * (`a / np.linalg.norm(a)`), so the results agree bit for bit with the
 * reference in the common case.
 */
export function normalize(a: Vec3): Vec3 {
  const n = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
}

/** The matrix whose columns are a, b and c (NumPy's `column_stack`). */
export function fromColumns(a: Vec3, b: Vec3, c: Vec3): Mat3 {
  return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
}

/** Column `j` of a matrix. */
export function column(m: Mat3, j: 0 | 1 | 2): Vec3 {
  return [m[j], m[3 + j], m[6 + j]];
}

/** m · v. */
export function mulVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** mᵀ · v, without building the transpose. */
export function mulTransposeVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
}

/** a · b. */
export function mul(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out.push(a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j]);
    }
  }
  return out as unknown as Mat3;
}

/** The transpose. */
export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** The determinant. */
export function det(m: Mat3): number {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6])
  );
}

/** Rotation by `angle` radians about the x axis (right-handed). */
export function rotationX(angle: number): Mat3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

/** Rotation by `angle` radians about the z axis (right-handed). */
export function rotationZ(angle: number): Mat3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/**
 * The rotation matrix of a rotation vector (axis times angle in radians).
 *
 * The same formula as OpenCV's `cv::Rodrigues` (modules/calib3d), which the
 * reference uses to scale a rotation by the strength:
 * R = cos θ I + (1 - cos θ) r rᵀ + sin θ [r]×, with r the unit axis.
 */
export function rodriguesToMatrix(v: Vec3): Mat3 {
  const theta = norm(v);
  if (theta < Number.EPSILON) return IDENTITY;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const c1 = 1 - c;
  const [x, y, z] = scale(v, 1 / theta);
  return [
    c + c1 * x * x,
    c1 * x * y - s * z,
    c1 * x * z + s * y,
    c1 * y * x + s * z,
    c + c1 * y * y,
    c1 * y * z - s * x,
    c1 * z * x - s * y,
    c1 * z * y + s * x,
    c + c1 * z * z,
  ];
}

/**
 * The rotation vector (axis times angle in radians) of a rotation matrix.
 *
 * Follows `cv::Rodrigues`: the angle from the trace, the axis from the
 * antisymmetric part. The correction's rotations stay well below 90°, so the
 * branch OpenCV keeps for angles near 180° is not needed; it returns the zero
 * vector there, where the axis is undefined from the antisymmetric part.
 */
export function matrixToRodrigues(m: Mat3): Vec3 {
  const rx = m[7] - m[5];
  const ry = m[2] - m[6];
  const rz = m[3] - m[1];
  const s = Math.sqrt((rx * rx + ry * ry + rz * rz) * 0.25);
  const c = Math.min(1, Math.max(-1, (m[0] + m[4] + m[8] - 1) * 0.5));
  if (s < 1e-5) return [0, 0, 0];
  const theta = Math.acos(c);
  const k = theta / (2 * s);
  return [rx * k, ry * k, rz * k];
}

/**
 * The unit vector x that minimises |A x|, for A given by its rows: the right
 * singular vector of the smallest singular value.
 *
 * One-sided Jacobi on A itself rather than an eigen-decomposition of AᵀA:
 * forming AᵀA squares the condition number, and the rows of a vanishing-point
 * fit are lines whose third coefficient is a thousand times the other two.
 * The sign of the result is arbitrary, as it is for an SVD.
 *
 * @param rows the rows of A (at least one)
 * @returns the unit right singular vector of the smallest singular value
 */
export function smallestRightSingularVector(rows: readonly Vec3[]): Vec3 {
  const a = rows.map((r) => [r[0], r[1], r[2]]);
  // v[j] is column j of V, accumulated from the same rotations as A's columns.
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const pairs: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];
  for (let sweep = 0; sweep < 60; sweep++) {
    let rotated = false;
    for (const [p, q] of pairs) {
      let alpha = 0;
      let beta = 0;
      let gamma = 0;
      for (const row of a) {
        alpha += row[p] * row[p];
        beta += row[q] * row[q];
        gamma += row[p] * row[q];
      }
      if (Math.abs(gamma) <= 1e-15 * Math.sqrt(alpha * beta)) continue;
      rotated = true;
      const zeta = (beta - alpha) / (2 * gamma);
      const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
      const c = 1 / Math.sqrt(1 + t * t);
      const s = c * t;
      for (const row of a) {
        const ap = row[p];
        const aq = row[q];
        row[p] = c * ap - s * aq;
        row[q] = s * ap + c * aq;
      }
      for (const vr of v) {
        const vp = vr[p];
        const vq = vr[q];
        vr[p] = c * vp - s * vq;
        vr[q] = s * vp + c * vq;
      }
    }
    if (!rotated) break;
  }
  let best = 0;
  let bestNorm = Infinity;
  for (let j = 0; j < 3; j++) {
    let n = 0;
    for (const row of a) n += row[j] * row[j];
    if (n < bestNorm) {
      bestNorm = n;
      best = j;
    }
  }
  return normalize([v[0][best], v[1][best], v[2][best]]);
}
