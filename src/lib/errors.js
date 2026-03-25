export class DocuSealError extends Error {
  constructor(status, message, url, body) {
    super(message)
    this.name = 'DocuSealError'
    this.status = status
    this.url = url
    this.body = body
  }
}

export async function handleApiError(res, url) {
  let message = res.statusText
  let body
  try {
    body = await res.json()
    message = body.error || body.message || res.statusText
  } catch {}
  throw new DocuSealError(res.status, message, url, body)
}
