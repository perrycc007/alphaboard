import { Logger } from '@nestjs/common';
import {
  ModelProvider,
  ModelReviewRequest,
  ModelReviewResponse,
} from './model-provider.interface';

/**
 * Routes each review to the provider best suited to its modality, per the
 * docs' model split: vision/chart reviews (image-bearing requests) go to the
 * visual model (Qwen); everything else (dataframe, metadata, catalyst,
 * strategy report) goes to the text model (DeepSeek).
 *
 * Either side may be absent; the router falls back to whichever provider is
 * configured so the workflow still runs end-to-end with a single key.
 */
export class MarketModelRouter implements ModelProvider {
  readonly name: string;
  readonly model: string;
  private readonly logger = new Logger(MarketModelRouter.name);

  constructor(
    private readonly textProvider: ModelProvider | null,
    private readonly visionProvider: ModelProvider | null,
  ) {
    if (!textProvider && !visionProvider) {
      throw new Error('MarketModelRouter requires at least one provider');
    }
    this.name = [textProvider?.name, visionProvider?.name]
      .filter(Boolean)
      .join('+');
    this.model = [
      textProvider ? `text:${textProvider.model}` : null,
      visionProvider ? `vision:${visionProvider.model}` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }

  review(request: ModelReviewRequest): Promise<ModelReviewResponse> {
    const wantsVision = (request.images?.length ?? 0) > 0;
    const provider = wantsVision
      ? (this.visionProvider ?? this.textProvider)
      : (this.textProvider ?? this.visionProvider);

    // Unreachable given the constructor guard, but keeps the type non-null.
    if (!provider) {
      throw new Error('No model provider available for request');
    }

    this.logger.debug(
      `Routing ${request.reviewType} (${wantsVision ? 'vision' : 'text'}) -> ${provider.name}`,
    );
    return provider.review(request);
  }
}
