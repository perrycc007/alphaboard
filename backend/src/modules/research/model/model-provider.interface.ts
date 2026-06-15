import { ModelReviewType } from '@prisma/client';

export const MODEL_PROVIDER = Symbol('MODEL_PROVIDER');

export interface ModelReviewRequest {
  reviewType: ModelReviewType;
  /** Natural-language instruction for the model */
  prompt: string;
  /** Structured payload (dataframe rows, metadata, etc.) */
  payload?: unknown;
  /** Image paths/URLs for vision review */
  images?: string[];
  targetType?: string;
  targetId?: string;
}

export interface ModelReviewResponse {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costEstimate?: number;
  result: Record<string, unknown>;
}

/**
 * Abstraction over an LLM / vision provider. Swapping implementations (mock,
 * Qwen, etc.) must not require touching callers — they depend on this contract.
 */
export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  review(request: ModelReviewRequest): Promise<ModelReviewResponse>;
}
