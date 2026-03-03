// src/lib/jsonSafeNumber.ts
export function jsonSafeNumber<T>(input: T): any {
  return JSON.parse(
    JSON.stringify(input, (_k, v) => {
      if (typeof v === "bigint") {
        const n = Number(v);
        if (!Number.isSafeInteger(n)) {
          throw new Error(`BigInt overflow: ${v.toString()} > MAX_SAFE_INTEGER`);
        }
        return n;
      }
      return v;
    })
  );
}