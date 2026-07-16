import { Injectable, Logger } from '@nestjs/common';
import { GoogleTtsService } from './google-tts.service';
import {
  DEFAULT_SPEECH_RATE,
  resolveMerchantVoice,
} from './providers/bangla-prompt';

@Injectable()
export class TtsPreviewService {
  private readonly logger = new Logger(TtsPreviewService.name);

  constructor(private googleTts: GoogleTtsService) {}

  /**
   * Build audible preview audio for settings / Voice Studio.
   * Chirp3 (google) voices use Maskara Google Cloud TTS only — no ePBX portal TTS.
   */
  async synthesize(
    text: string,
    voiceId?: string | null,
    speechRate?: number | null,
  ): Promise<{
    mimeType: string;
    audioBase64: string;
    engine: string;
    voice: string;
  }> {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) throw new Error('Preview text is empty');

    const voice = resolveMerchantVoice(voiceId);
    const clipped = clean.slice(0, 280);

    if (voice.provider === 'google') {
      if (!this.googleTts.isConfigured()) {
        throw new Error(
          'GOOGLE_TTS_API_KEY not configured — Chirp3 preview requires Maskara Google TTS (ePBX voice fallback disabled)',
        );
      }
      this.logger.log(
        `Preview Google TTS voiceId=${voice.id} rate=${speechRate ?? DEFAULT_SPEECH_RATE}`,
      );
      try {
        const result = await this.googleTts.synthesize(
          clipped,
          voice.voiceId,
          speechRate ?? DEFAULT_SPEECH_RATE,
        );
        return {
          mimeType: result.mimeType,
          audioBase64: result.buffer.toString('base64'),
          engine: 'google_cloud_tts',
          voice: voice.id,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Google Cloud TTS preview failed: ${msg}`);
        throw new Error(`Maskara Google TTS preview failed: ${msg}`);
      }
    }

    // Legacy Azure catalog entries — Translate TTS only (no ePBX portal TTS).
    const fromGoogle = await this.googleTranslateTts(clipped);
    return {
      ...fromGoogle,
      engine: 'google_translate_fallback',
      voice: voice.id,
    };
  }

  /** Reliable Bangla preview when Cloud TTS unavailable for non-Chirp3 voices */
  private async googleTranslateTts(
    text: string,
  ): Promise<{ mimeType: string; audioBase64: string; engine: string }> {
    const chunks = this.chunkText(text, 180);
    const parts: Buffer[] = [];

    for (const chunk of chunks) {
      const url =
        'https://translate.google.com/translate_tts?' +
        new URLSearchParams({
          ie: 'UTF-8',
          client: 'tw-ob',
          tl: 'bn',
          q: chunk,
        }).toString();

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
          Referer: 'https://translate.google.com/',
        },
      });
      if (!res.ok) {
        throw new Error(`Preview TTS failed (${res.status})`);
      }
      parts.push(Buffer.from(await res.arrayBuffer()));
    }

    return {
      mimeType: 'audio/mpeg',
      audioBase64: Buffer.concat(parts).toString('base64'),
      engine: 'google_translate',
    };
  }

  private chunkText(text: string, max: number): string[] {
    if (text.length <= max) return [text];
    const chunks: string[] = [];
    let rest = text;
    while (rest.length > 0) {
      if (rest.length <= max) {
        chunks.push(rest);
        break;
      }
      let cut = rest.lastIndexOf(' ', max);
      if (cut < max * 0.5) cut = max;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    return chunks.filter(Boolean).slice(0, 4);
  }
}
