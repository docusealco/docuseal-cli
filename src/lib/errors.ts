export class DocuSealError extends Error {
  constructor(
    public status: number,
    message: string,
    public url: string,
    public body?: unknown
  ) {
    super(message)
    this.name = 'DocuSealError'
  }
}

export async function handleApiError(res: Response, url: string): Promise<never> {
  let message = res.statusText
  let body: unknown
  try {
    body = await res.json()
    message = (body as any).error || (body as any).message || res.statusText
  } catch {}
  throw new DocuSealError(res.status, message, url, body)
}
