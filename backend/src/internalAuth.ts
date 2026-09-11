import { timingSafeEqual } from 'node:crypto'

/** Compares internal service credentials without leaking prefix information. */
export function validServiceSecret(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  return expectedBuffer.length >= 20
    && providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer)
}
