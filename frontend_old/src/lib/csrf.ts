export function getCookie(name: string): string {
  const v = `; ${document.cookie}`
  const p = v.split(`; ${name}=`)
  return p.length === 2 ? p.pop()!.split(';').shift()! : ''
}
export function getCSRF(): string {
  return getCookie('csrftoken') || ''
}
