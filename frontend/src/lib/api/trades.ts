import { api } from '@/lib/api-client'
import type { ApiPosition, ApiTradeIdea, Direction, Bias } from '@/types'

export function fetchPositions(): Promise<ApiPosition[]> {
  return api.get<ApiPosition[]>('/trades/positions')
}

export function fetchTradeIdeas(): Promise<ApiTradeIdea[]> {
  return api.get<ApiTradeIdea[]>('/trades/ideas')
}

export interface CreateTradeIdeaInput {
  stockId: string
  direction: Direction
  bias: Bias
  stopPrice: number
  entryPrice?: number
  targetPrice?: number
  riskPercent: number
  setupId?: string
  notes?: string
}

export function createTradeIdea(input: CreateTradeIdeaInput): Promise<ApiTradeIdea> {
  return api.post<ApiTradeIdea>('/trades/ideas', input)
}
