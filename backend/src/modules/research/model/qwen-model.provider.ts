import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { extname } from 'path';
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

@Injectable()
export class QwenModelProvider implements ModelProvider {
  readonly name = 'qwen';
  private readonly logger = new Logger(QwenModelProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  readonly model: string;
  private readonly visionTriageModel: string;
  private readonly visionDeepModel: string;
  private readonly visionFallbackModel: string;
  private readonly costPer1kInput: number;
  private readonly costPer1kOutput: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey =
      this.config.get<string>('DASHSCOPE_API_KEY') ??
      this.config.get<string>('QWEN_API_KEY', '');
    this.baseUrl =
      this.config.get<string>('DASHSCOPE_BASE_URL') ??
      this.config.get<string>(
        'QWEN_BASE_URL',
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      );
    this.model =
      this.config.get<string>('QWEN_TEXT_MODEL') ??
      this.config.get<string>('QWEN_MODEL', 'qwen-plus');
    this.visionTriageModel = this.config.get<string>(
      'QWEN_VISION_TRIAGE_MODEL',
      'qwen3-vl-flash',
    );
    this.visionDeepModel = this.config.get<string>(
      'QWEN_VISION_DEEP_MODEL',
      'qwen3-vl-plus',
    );
    this.visionFallbackModel = this.config.get<string>(
      'QWEN_VISION_FALLBACK_MODEL',
      'qwen-vl-max-latest',
    );
    this.costPer1kInput = Number(
      this.config.get<string>('QWEN_COST_PER_1K_INPUT', '0.0004'),
    );
    this.costPer1kOutput = Number(
      this.config.get<string>('QWEN_COST_PER_1K_OUTPUT', '0.0012'),
    );
  }

  async review(request: ModelReviewRequest): Promise<ModelReviewResponse> {
    const selectedModel = this.selectModel(request);
    const body = {
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: `${ALPHABOARD_SYSTEM_CONTEXT}\n\n${reviewTypeGuidance(request.reviewType)}`,
        },
        {
          role: 'user',
          content: this.buildUserContent(request),
        },
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
      this.logger.error(`Qwen request failed (${res.status}): ${text}`);
      throw new Error(`Qwen request failed: ${res.status}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    return {
      provider: this.name,
      model: selectedModel,
      inputTokens,
      outputTokens,
      costEstimate:
        (inputTokens / 1000) * this.costPer1kInput +
        (outputTokens / 1000) * this.costPer1kOutput,
      result: this.parseJson(content),
    };
  }

  private selectModel(request: ModelReviewRequest): string {
    if (!request.images?.length) {
      return this.model;
    }
    if (request.reviewType === 'CHART_REVIEW') {
      return this.visionDeepModel || this.visionFallbackModel;
    }
    return this.visionTriageModel;
  }

  private buildUserContent(
    request: ModelReviewRequest,
  ): string | Array<Record<string, unknown>> {
    const prompt = this.buildPrompt(request);
    if (!request.images?.length) {
      return prompt;
    }

    return [
      { type: 'text', text: prompt },
      ...request.images.map((image) => ({
        type: 'image_url',
        image_url: { url: this.toImageUrl(image) },
      })),
    ];
  }

  private buildPrompt(request: ModelReviewRequest): string {
    const parts = [request.prompt];
    if (request.payload !== undefined) {
      parts.push('\nDATA:\n' + JSON.stringify(request.payload));
    }
    return parts.join('\n');
  }

  private toImageUrl(image: string): string {
    if (
      image.startsWith('http://') ||
      image.startsWith('https://') ||
      image.startsWith('data:image/')
    ) {
      return image;
    }

    const bytes = readFileSync(image);
    return `data:${this.mimeTypeFor(image)};base64,${bytes.toString('base64')}`;
  }

  private mimeTypeFor(path: string): string {
    switch (extname(path).toLowerCase()) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.png':
      default:
        return 'image/png';
    }
  }

  private parseJson(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return { raw: content, parseError: true };
    }
  }
}
