export function createAlias(title: string): string {
  // Encode the string as UTF-8 and then to base64
  const utf8Bytes = new TextEncoder().encode(title)
  const base64 = btoa(String.fromCharCode(...utf8Bytes))
  // Remove padding and replace characters for GraphQL compatibility
  return base64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function unHashAlias(alias: string): string {
  // Restore base64 padding and characters
  let base64 = alias.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
