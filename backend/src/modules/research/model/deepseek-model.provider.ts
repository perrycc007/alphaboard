import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ModelProvider,
  ModelReviewRequest,
  ModelReviewResponse,
} from './model-provider.interface';
import { ALPHABOARD_SYSTEM_CONTEXT, reviewTypeGuidance } from './domain-context';

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * DeepSeek text-reasoning provider (OpenAI-compatible chat completions).
 * Handles structured dataframe/metadata/catalyst/report reasoning. It has no
 * vision capability, so image-bearing requests are routed to Qwen upstream.
 */
@Injectable()
export class DeepSeekModelProvider implements ModelProvider {
  readonly name = 'deepseek';
  private readonly logger = new Logger(DeepSeekModelProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  readonly model: string;
  private readonly costPer1kInput: number;
  private readonly costPer1kOutput: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('DEEPSEEK_API_KEY', '');
    this.baseUrl = this.config.get<string>(
      'DEEPSEEK_BASE_URL',
      'https://api.deepseek.com/v1',
    );
    this.model = this.config.get<string>('DEEPSEEK_TEXT_MODEL', 'deepseek-chat');
    this.costPer1kInput = Number(
      this.config.get<string>('DEEPSEEK_COST_PER_1K_INPUT', '0.00027'),
    );
    this.costPer1kOutput = Number(
      this.config.get<string>('DEEPSEEK_COST_PER_1K_OUTPUT', '0.0011'),
    );
  }

  async review(request: ModelReviewRequest): Promise<ModelReviewResponse> {
    const body = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `${ALPHABOARD_SYSTEM_CONTEXT}\n\n${reviewTypeGuidance(request.reviewType)}`,
        },
        { role: 'user', content: this.buildPrompt(request) },
      ],
      response_format: { type: 'json_object' as const },
      temperature: 0.2,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`DeepSeek request failed (${res.status}): ${text}`);
      throw new Error(`DeepSeek request failed: ${res.status}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    return {
      provider: this.name,
      model: this.model,
      inputTokens,
      outputTokens,
      costEstimate:
        (inputTokens / 1000) * this.costPer1kInput +
        (outputTokens / 1000) * this.costPer1kOutput,
      result: this.parseJson(content),
    };
  }

  private buildPrompt(request: ModelReviewRequest): string {
    const parts = [request.prompt];
    if (request.payload !== undefined) {
      parts.push('\nDATA:\n' + JSON.stringify(request.payload));
    }
    return parts.join('\n');
  }

  private parseJson(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return { raw: content, parseError: true };
    }
  }
}
