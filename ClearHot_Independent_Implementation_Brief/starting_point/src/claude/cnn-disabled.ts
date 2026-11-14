// Deliberately disabled for this classical-only local evaluator.
export type Variant = 'A' | 'B' | 'C';
export function getCnn(_v: Variant): null { return null; }
export async function cnnRestore(_m: never, _x: Float32Array, _w: number, _h: number, _strength: number): Promise<Float32Array> { throw new Error('CNN is disabled in this evaluator'); }
