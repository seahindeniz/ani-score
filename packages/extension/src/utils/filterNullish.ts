export function filterNullish<List>(array: (List | null | undefined)[]): List[] {
  return array.filter(item => item != null)
}
