import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  NotFoundException,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { appendJsonLog } from '../../common/utils/file-log.util';

// Resolve artifacts from repo root (sibling of `backend/`), regardless of dist/src runtime location.
const ARTIFACTS_ROOT = path.resolve(process.cwd(), '../artifacts/setup_review');

interface LabelEntry {
  chart_id: string;
  human_label: 'yes' | 'no' | 'wrong_type' | 'unsure';
  correct_type: string | null;
  reviewed_at: string;
  reviewer?: string;
  source?: 'web' | 'telegram';
}

interface ManifestEntry {
  chart_id: string;
  ticker: string;
  setup_type: string;
  alert_date: string;
  alert_price: number;
  window_start: string;
  window_end: string;
  rule_version: string;
  chart_path: string;
  direction?: string;
}

interface TelegramSendNextBody {
  chatId: string | number;
  version?: string;
}

function shouldIgnoreForTelegram(entry: ManifestEntry): boolean {
  const normalizedPath = entry.chart_path.replace(/\\/g, '/').toLowerCase();
  return (
    normalizedPath.includes('trend_long_legacy') ||
    normalizedPath.includes('trend-long-legacy') ||
    normalizedPath.includes('trend long legacy') ||
    (normalizedPath.includes('trend_long') && normalizedPath.includes('legacy'))
  );
}

function getLabelsPath(version: string): string {
  return path.join(ARTIFACTS_ROOT, version, 'labels.json');
}

function readLabels(version: string): LabelEntry[] {
  const p = getLabelsPath(version);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeLabels(version: string, labels: LabelEntry[]): void {
  const p = getLabelsPath(version);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(labels, null, 2));
}

function readManifest(version: string): ManifestEntry[] {
  const manifestPath = path.join(ARTIFACTS_ROOT, version, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new NotFoundException(`Manifest not found for version ${version}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ManifestEntry[];
}

function getNextUnlabeled(version: string, forTelegram = false): ManifestEntry | null {
  const manifest = readManifest(version);
  const labels = readLabels(version);
  const labeled = new Set(labels.map((l) => l.chart_id));
  return (
    manifest.find((m) => !labeled.has(m.chart_id) && (!forTelegram || !shouldIgnoreForTelegram(m))) ?? null
  );
}

async function telegramApi(method: string, init: RequestInit): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new BadRequestException('TELEGRAM_BOT_TOKEN is not configured');
  }
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new BadRequestException(`Telegram API ${method} failed: ${text}`);
  }
  return res.json();
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await telegramApi('answerCallbackQuery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function sendTelegramChart(
  chatId: string | number,
  version: string,
  entry: ManifestEntry,
): Promise<void> {
  const htmlPath = path.resolve(path.join(ARTIFACTS_ROOT, version, entry.chart_path));
  const parsedChartPath = path.parse(entry.chart_path);
  const pngChartPath = path.join(parsedChartPath.dir, `${parsedChartPath.name}.png`);
  const imagePath = path.resolve(path.join(ARTIFACTS_ROOT, version, pngChartPath));
  const caption =
    `${entry.setup_type}\n${entry.ticker} • ${entry.alert_date}\nWindow: ${entry.window_start} → ${entry.window_end}`;
  const replyMarkup = JSON.stringify({
    inline_keyboard: [
      [
        { text: '✅ Yes', callback_data: `lb|${version}|${entry.chart_id}|yes` },
        { text: '❌ No', callback_data: `lb|${version}|${entry.chart_id}|no` },
      ],
    ],
  });

  const artifactsRoot = path.resolve(ARTIFACTS_ROOT);
  if (!imagePath.startsWith(artifactsRoot) || !htmlPath.startsWith(artifactsRoot)) {
    throw new NotFoundException('Invalid chart path');
  }

  if (fs.existsSync(imagePath)) {
    const bytes = await fs.promises.readFile(imagePath);
    const photoForm = new FormData();
    photoForm.append('chat_id', String(chatId));
    photoForm.append('caption', caption);
    photoForm.append('photo', new Blob([bytes]), path.basename(imagePath));
    photoForm.append('reply_markup', replyMarkup);
    await telegramApi('sendPhoto', { method: 'POST', body: photoForm });
    return;
  }

  if (fs.existsSync(htmlPath)) {
    const htmlBytes = await fs.promises.readFile(htmlPath);
    const docForm = new FormData();
    docForm.append('chat_id', String(chatId));
    docForm.append('caption', `${caption}\n(PNG missing, sent HTML fallback)`);
    docForm.append('document', new Blob([htmlBytes]), path.basename(htmlPath));
    docForm.append('reply_markup', replyMarkup);
    await telegramApi('sendDocument', { method: 'POST', body: docForm });
    return;
  }

  throw new NotFoundException(
    `Chart files not found. Missing PNG: ${pngChartPath} and HTML: ${entry.chart_path}`,
  );
}

@Controller('api/labels')
@AllowAnonymous()
export class LabelController {
  @Get('manifest/:version')
  getManifest(@Param('version') version: string) {
    return readManifest(version);
  }

  @Get('labels/:version')
  getLabels(@Param('version') version: string) {
    return readLabels(version);
  }

  @Post('labels/:version')
  saveLabel(
    @Param('version') version: string,
    @Body() body: LabelEntry,
  ) {
    const labels = readLabels(version);
    const existing = labels.findIndex((l) => l.chart_id === body.chart_id);
    if (existing >= 0) {
      labels[existing] = body;
    } else {
      labels.push(body);
    }
    writeLabels(version, labels);
    return { saved: true, total: labels.length };
  }

  @Post('telegram/send-next')
  async sendTelegramNext(@Body() body: TelegramSendNextBody) {
    const version = body.version ?? 'v1';
    if (!body.chatId) throw new BadRequestException('chatId is required');

    const next = getNextUnlabeled(version, true);
    if (!next) {
      await telegramApi('sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(body.chatId),
          text: `No unlabeled charts left for version ${version}.`,
        }),
      });
      return { sent: false, reason: 'queue_empty' };
    }

    await sendTelegramChart(body.chatId, version, next);
    return { sent: true, chart_id: next.chart_id };
  }

  @Post('telegram/set-webhook')
  async setTelegramWebhook(@Body() body: { webhookUrl: string }) {
    if (!body.webhookUrl) {
      throw new BadRequestException('webhookUrl is required');
    }
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    return telegramApi('setWebhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: body.webhookUrl,
        ...(secretToken ? { secret_token: secretToken } : {}),
      }),
    });
  }

  @Post('telegram/webhook')
  async telegramWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretHeader?: string,
  ) {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secretHeader !== expectedSecret) {
      throw new BadRequestException('Invalid Telegram webhook secret');
    }

    try {
      await appendJsonLog('telegram-inbound.json', {
        source: 'telegram_webhook',
        updateId: update?.update_id ?? null,
        messageText: update?.message?.text ?? null,
        callbackData: update?.callback_query?.data ?? null,
        chatId:
          update?.message?.chat?.id ??
          update?.callback_query?.message?.chat?.id ??
          update?.callback_query?.from?.id ??
          null,
        payload: update,
      });
    } catch {
      // Non-critical logging path; webhook processing should continue.
    }

    // /start and /next commands from Telegram chat
    if (update?.message?.chat?.id && typeof update.message.text === 'string') {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim().toLowerCase();
      if (text === '/stopped') {
        const screenshotPath = path.resolve(process.cwd(), '../Screenshot 2024-02-29 144011.png');
        if (fs.existsSync(screenshotPath)) {
          const bytes = await fs.promises.readFile(screenshotPath);
          const form = new FormData();
          form.append('chat_id', String(chatId));
          form.append('caption', 'POC screenshot');
          form.append('photo', new Blob([bytes]), path.basename(screenshotPath));
          await telegramApi('sendPhoto', { method: 'POST', body: form });
          return { ok: true, sent: 'screenshot_image' };
        }

        const seed = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
        const photoUrl = `https://picsum.photos/seed/${seed}/1280/720`;
        await telegramApi('sendPhoto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: String(chatId),
            photo: photoUrl,
            caption: 'POC random image',
          }),
        });
        return { ok: true, sent: 'random_image' };
      }

      if (text === '/start' || text === '/next') {
        const next = getNextUnlabeled('v1', true);
        if (!next) {
          await telegramApi('sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: String(chatId),
              text: 'No unlabeled charts left in v1 queue.',
            }),
          });
          return { ok: true, queue: 'empty' };
        }
        await sendTelegramChart(chatId, 'v1', next);
        return { ok: true, sent: next.chart_id };
      }
    }

    // Inline callback for Yes/No labeling
    const callback = update?.callback_query;
    if (callback?.id && callback?.from?.id && typeof callback?.data === 'string') {
      const chatId = callback.message?.chat?.id ?? callback.from.id;
      const [prefix, version, chartId, label] = callback.data.split('|');
      if (prefix !== 'lb' || !version || !chartId || !label) {
        await answerCallbackQuery(callback.id, 'Invalid callback payload');
        return { ok: true, ignored: true };
      }

      const normalized = label === 'yes' || label === 'no' ? label : 'unsure';
      const labels = readLabels(version);
      const entry: LabelEntry = {
        chart_id: chartId,
        human_label: normalized,
        correct_type: null,
        reviewed_at: new Date().toISOString(),
        reviewer: `telegram:${callback.from.id}`,
        source: 'telegram',
      };
      const existing = labels.findIndex((l) => l.chart_id === chartId);
      if (existing >= 0) labels[existing] = entry;
      else labels.push(entry);
      writeLabels(version, labels);

      await answerCallbackQuery(callback.id, `Saved: ${normalized.toUpperCase()}`);

      const next = getNextUnlabeled(version, true);
      if (!next) {
        await telegramApi('sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: String(chatId),
            text: `Done. No unlabeled charts left for ${version}.`,
          }),
        });
        return { ok: true, queue: 'empty' };
      }

      await sendTelegramChart(chatId, version, next);
      return { ok: true, next: next.chart_id };
    }

    return { ok: true, ignored: true };
  }

  @Get('image/:version/*')
  serveImage(
    @Param('version') version: string,
    @Param() params: Record<string, string>,
    @Res() res: Response,
  ) {
    const wildcardPath = (params as any)[0] || params['0'] || '';
    const imgPath = path.join(ARTIFACTS_ROOT, version, wildcardPath);
    const resolved = path.resolve(imgPath);

    if (!resolved.startsWith(path.resolve(ARTIFACTS_ROOT))) {
      throw new NotFoundException('Invalid path');
    }
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('Image not found');
    }
    res.sendFile(resolved);
  }

  @Get('stats/:version')
  getStats(@Param('version') version: string) {
    const manifestPath = path.join(ARTIFACTS_ROOT, version, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new NotFoundException(`Manifest not found for version ${version}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const labels = readLabels(version);

    const labelMap = new Map(labels.map((l) => [l.chart_id, l]));
    const total = manifest.length;
    const labeled = labels.length;
    const byType: Record<string, { total: number; yes: number; no: number; wrong_type: number; unsure: number }> = {};

    for (const item of manifest) {
      const t = item.setup_type;
      if (!byType[t]) byType[t] = { total: 0, yes: 0, no: 0, wrong_type: 0, unsure: 0 };
      byType[t].total++;
      const label = labelMap.get(item.chart_id);
      if (label) {
        byType[t][label.human_label]++;
      }
    }

    return { total, labeled, unlabeled: total - labeled, byType };
  }
}
