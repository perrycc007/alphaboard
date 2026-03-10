import type { Response } from 'express';
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
export declare class LabelController {
    getManifest(version: string): ManifestEntry[];
    getLabels(version: string): LabelEntry[];
    saveLabel(version: string, body: LabelEntry): {
        saved: boolean;
        total: number;
    };
    sendTelegramNext(body: TelegramSendNextBody): Promise<{
        sent: boolean;
        reason: string;
        chart_id?: undefined;
    } | {
        sent: boolean;
        chart_id: string;
        reason?: undefined;
    }>;
    setTelegramWebhook(body: {
        webhookUrl: string;
    }): Promise<unknown>;
    telegramWebhook(update: any, secretHeader?: string): Promise<{
        ok: boolean;
        sent: string;
        queue?: undefined;
        ignored?: undefined;
        next?: undefined;
    } | {
        ok: boolean;
        queue: string;
        sent?: undefined;
        ignored?: undefined;
        next?: undefined;
    } | {
        ok: boolean;
        ignored: boolean;
        sent?: undefined;
        queue?: undefined;
        next?: undefined;
    } | {
        ok: boolean;
        next: string;
        sent?: undefined;
        queue?: undefined;
        ignored?: undefined;
    }>;
    serveImage(version: string, params: Record<string, string>, res: Response): void;
    getStats(version: string): {
        total: any;
        labeled: number;
        unlabeled: number;
        byType: Record<string, {
            total: number;
            yes: number;
            no: number;
            wrong_type: number;
            unsure: number;
        }>;
    };
}
export {};
