export function objectOmit<T extends object, K extends (keyof T)[]>(obj: T, keys: K, options?: { omitUndefined?: boolean }): Omit<T, K[number]> {
  const exclude = new Set(keys)

  return Object.fromEntries(Object.entries(obj).filter(
    e => !exclude.has(e[0] as keyof T) && (!options?.omitUndefined || e[1] !== undefined),
  )) as Omit<T, K[number]>
}
