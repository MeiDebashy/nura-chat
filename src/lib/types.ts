export interface ChatRequest {
  message: string
  userId: string
  timestamp: string
}

export interface ChatResponse {
  segments: string[]
  crisis?: boolean
}
