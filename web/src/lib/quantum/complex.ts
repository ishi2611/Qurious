/**
 * Minimal complex-number helpers. Plain objects (not classes) so states can be
 * copied, serialized, and compared in tests without surprises.
 */
export interface Complex {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });

export const ZERO = c(0);
export const ONE = c(1);

export const add = (a: Complex, b: Complex): Complex =>
  c(a.re + b.re, a.im + b.im);

export const mul = (a: Complex, b: Complex): Complex =>
  c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

export const conj = (a: Complex): Complex => c(a.re, -a.im);

/** |a|², the probability weight of an amplitude. */
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;

/** e^{iθ} */
export const expi = (theta: number): Complex =>
  c(Math.cos(theta), Math.sin(theta));

export const scale = (a: Complex, k: number): Complex => c(a.re * k, a.im * k);

export const approxEqual = (a: Complex, b: Complex, tol = 1e-9): boolean =>
  Math.abs(a.re - b.re) <= tol && Math.abs(a.im - b.im) <= tol;
