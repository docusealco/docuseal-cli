export class DocuSealError extends Error {
  constructor(
    public status: number,
    message: string,
    public url: string
  ) {
    super(message)
    this.name = 'DocuSealError'
  }
}

export async function handleApiError(res: Response, url: string): Promise<never> {
  let message = res.statusText
  try {
    const body = await res.json()
    message = body.error || body.message || JSON.stringify(body)
  } catch {}
  throw new DocuSealError(res.status, message, url)
}
