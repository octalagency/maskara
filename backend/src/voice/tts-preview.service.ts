import { Injectable, Logger } from '@nestjs/common';
import { VoiceSettingsService } from './voice-settings.service';
import { GoogleTtsService } from './google-tts.service';
import {
  DEFAULT_SPEECH_RATE,
  resolveMerchantVoice,
} from './providers/bangla-prompt';

@Injectable()
export class TtsPreviewService {
  private readonly logger = new Logger(TtsPreviewService.name);

  constructor(
    private settings: VoiceSettingsService,
    private googleTts: GoogleTtsService,
  ) {}

  /**
   * Build audible preview audio for settings UI.
   * Prefer direct Google Cloud TTS for Chirp3 / when key present;
   * then ePBX TTS; then Google Translate TTS fallback.
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

    if (voice.provider === 'google' && this.googleTts.isConfigured()) {
      try {
        this.logger.log(
          `Preview Google TTS voiceId=${voice.id} rate=${speechRate ?? DEFAULT_SPEECH_RATE}`,
        );
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
        this.logger.warn(
          `Google Cloud TTS preview failed, falling back: ${err instanceof Error ? err.message : err}`,
        );
      }
    } else if (voice.provider === 'google') {
      this.logger.warn(
        `Preview: Google voice ${voice.id} but GOOGLE_TTS_API_KEY missing`,
      );
    }

    const fromEpbx = await this.tryEpbxTts(clipped, voice);
    if (fromEpbx) return { ...fromEpbx, voice: voice.id };

    const fromGoogle = await this.googleTranslateTts(clipped);
    return {
      ...fromGoogle,
      engine: 'google_translate_fallback',
      voice: voice.id,
    };
  }

  private async tryEpbxTts(
    text: string,
    voice: { provider: string; voiceId: string; id: string },
  ): Promise<{ mimeType: string; audioBase64: string; engine: string } | null> {
    const apiKey = this.settings.get('EPBX_API_KEY');
    if (!apiKey) return null;

    const baseUrl = (
      this.settings.get('EPBX_API_URL') || 'https://epbx.bd/api/v1'
    ).replace(/\/$/, '');

    const payload: Record<string, unknown> = {
      text,
      tts_text: text,
      message: text,
      language: 'bn',
      tts_language: voice.provider === 'google' ? 'bn-IN' : 'bn-BD',
      provider: voice.provider,
      ai_tts_provider: voice.provider,
      tts_provider: voice.provider,
      voice_id: voice.voiceId,
      tts_voice: voice.voiceId,
      voice: voice.voiceId,
    };

    if (voice.provider === 'azure') {
      payload.azure_tts_voice_id = voice.voiceId;
      payload.azure_voice = voice.voiceId;
    } else if (voice.provider === 'google') {
      payload.google_tts_voice_id = voice.voiceId;
      payload.google_voice = voice.voiceId;
    } else if (voice.provider === 'elevenlabs') {
      payload.elevenlabs_voice_id = voice.voiceId;
      payload.eleven_labs_voice_id = voice.voiceId;
    }

    const paths = [
      '/tts',
      '/tts/synthesize',
      '/tts/preview',
      '/ai/tts',
      '/elevenlabs/tts',
      '/flow/elevenlabs/tts',
    ];

    for (const path of paths) {
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg, application/json, */*',
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) continue;

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('audio') || contentType.includes('octet-stream')) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 64) continue;
          return {
            mimeType: contentType.includes('wav') ? 'audio/wav' : 'audio/mpeg',
            audioBase64: buf.toString('base64'),
            engine: `epbx${path}`,
          };
        }

        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const b64 =
          (body?.audio_base64 as string) ||
          (body?.audioBase64 as string) ||
          (body?.audio as string) ||
          ((body?.data as { audio?: string } | undefined)?.audio);
        if (b64 && typeof b64 === 'string' && b64.length > 64) {
          const raw = b64.includes(',') ? b64.split(',')[1] : b64;
          return {
            mimeType: 'audio/mpeg',
            audioBase64: raw,
            engine: `epbx${path}`,
          };
        }

        const url =
          (body?.url as string) ||
          (body?.audio_url as string) ||
          ((body?.data as { url?: string } | undefined)?.url);
        if (url && typeof url === 'string') {
          const audioRes = await fetch(url);
          if (!audioRes.ok) continue;
          const buf = Buffer.from(await audioRes.arrayBuffer());
          if (buf.length < 64) continue;
          return {
            mimeType: 'audio/mpeg',
            audioBase64: buf.toString('base64'),
            engine: `epbx${path}`,
          };
        }
      } catch (err) {
        this.logger.debug(`ePBX TTS ${path} failed: ${err}`);
      }
    }

    return null;
  }

  /** Reliable Bangla preview when Cloud TTS / ePBX unavailable */
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
