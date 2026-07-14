import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VoiceSettingsService } from './voice-settings.service';
import { S3StorageService } from '../common/services/s3-storage.service';
import {
  DEFAULT_SPEECH_RATE,
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_VOLUME_GAIN_DB,
  toChirpExpressiveMarkup,
} from './providers/bangla-prompt';

@Injectable()
export class GoogleTtsService {
  private readonly logger = new Logger(GoogleTtsService.name);
  /** Short-lived MP3 cache for ePBX to fetch */
  private readonly cache = new Map<
    string,
    { buf: Buffer; mime: string; expires: number }
  >();

  constructor(
    private settings: VoiceSettingsService,
    private s3: S3StorageService,
  ) {}

  isConfigured(): boolean {
    return this.settings.isGoogleTtsConfigured();
  }

  private getApiKey(): string | undefined {
    return (
      this.settings.get('GOOGLE_TTS_API_KEY') ||
      this.settings.get('GOOGLE_CLOUD_TTS_API_KEY')
    );
  }

  private publicApiBase(): string {
    return (
      this.settings.get('PUBLIC_API_URL') ||
      'https://api.maskara.bd'
    ).replace(/\/$/, '');
  }

  /**
   * Synthesize MP3 via Google Cloud Text-to-Speech REST API (API key).
   */
  async synthesizeMp3(
    text: string,
    opts?: { languageCode?: string; voiceName?: string; speakingRate?: number },
  ): Promise<Buffer> {
    const result = await this.synthesize(
      text,
      opts?.voiceName || 'bn-IN-Chirp3-HD-Algieba',
      opts?.speakingRate,
    );
    return result.buffer;
  }

  async synthesize(
    text: string,
    voiceName = 'bn-IN-Chirp3-HD-Algieba',
    speakingRate: number = DEFAULT_SPEECH_RATE,
  ): Promise<{ buffer: Buffer; mimeType: string; voice: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('GOOGLE_TTS_API_KEY not configured');
    }

    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 4500);
    if (!clean) throw new Error('Empty TTS text');

    const languageCode = voiceName.startsWith('bn-')
      ? voiceName.slice(0, 5)
      : 'bn-IN';

    const rate = Math.min(
      1.35,
      Math.max(0.75, Number(speakingRate) || DEFAULT_SPEECH_RATE),
    );
    const isChirp3 = /Chirp3-HD-/i.test(voiceName);

    // Chirp3: markup + pause tags for call-center pacing.
    // Non-Chirp: plain text; pitch can warm delivery slightly.
    const input = isChirp3
      ? { markup: toChirpExpressiveMarkup(clean) }
      : { text: clean };

    const audioConfig: Record<string, unknown> = {
      audioEncoding: 'MP3',
      speakingRate: rate,
      volumeGainDb: DEFAULT_TTS_VOLUME_GAIN_DB,
    };
    if (!isChirp3) {
      audioConfig.pitch = DEFAULT_TTS_PITCH;
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        voice: { languageCode, name: voiceName },
        audioConfig,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      audioContent?: string;
      error?: { message?: string };
    };

    if (!res.ok || !body.audioContent) {
      const msg = body.error?.message || `Google TTS failed (${res.status})`;
      this.logger.error(msg);
      // Markup can fail on older API keys / regions — retry as plain text once.
      if (isChirp3 && 'markup' in input) {
        this.logger.warn('Chirp3 markup synthesize failed — retrying plain text');
        return this.synthesizePlain(clean, voiceName, rate, languageCode, apiKey);
      }
      throw new Error(msg);
    }

    const buffer = Buffer.from(body.audioContent, 'base64');
    this.logger.log(
      `Google TTS ok voice=${voiceName} rate=${rate} markup=${isChirp3} bytes=${buffer.length} chars=${clean.length}`,
    );
    return { buffer, mimeType: 'audio/mpeg', voice: voiceName };
  }

  private async synthesizePlain(
    clean: string,
    voiceName: string,
    rate: number,
    languageCode: string,
    apiKey: string,
  ): Promise<{ buffer: Buffer; mimeType: string; voice: string }> {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: clean },
        voice: { languageCode, name: voiceName },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: rate,
          volumeGainDb: DEFAULT_TTS_VOLUME_GAIN_DB,
        },
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      audioContent?: string;
      error?: { message?: string };
    };

    if (!res.ok || !body.audioContent) {
      const msg = body.error?.message || `Google TTS failed (${res.status})`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    const buffer = Buffer.from(body.audioContent, 'base64');
    this.logger.log(
      `Google TTS plain ok voice=${voiceName} rate=${rate} bytes=${buffer.length}`,
    );
    return { buffer, mimeType: 'audio/mpeg', voice: voiceName };
  }

  /**
   * Host MP3 for ePBX to download — S3 if configured, else short-lived API URL.
   */
  async hostAudio(
    buffer: Buffer,
    mimeTypeOrMerchant?: string,
    label?: string,
  ): Promise<string> {
    const mime =
      mimeTypeOrMerchant?.startsWith('audio/')
        ? mimeTypeOrMerchant
        : 'audio/mpeg';
    const merchantId =
      mimeTypeOrMerchant?.startsWith('audio/')
        ? label || 'system'
        : mimeTypeOrMerchant || label || 'system';

    if (this.s3.isConfigured()) {
      const key = `tts/${merchantId}/${Date.now()}-${randomUUID()}.mp3`;
      const url = await this.s3.uploadBuffer(buffer, key, mime);
      if (url) return url;
    }

    const id = this.cacheAudio(buffer, mime);
    return `${this.publicApiBase()}/voice/tts-audio/${id}`;
  }

  cacheAudio(buffer: Buffer, mimeType = 'audio/mpeg', ttlMs = 15 * 60 * 1000): string {
    this.prune();
    const id = randomUUID();
    this.cache.set(id, { buf: buffer, mime: mimeType, expires: Date.now() + ttlMs });
    return id;
  }

  getCached(id: string): { buf: Buffer; mime: string } | null {
    const clean = id.replace(/\.mp3$/i, '');
    const row = this.cache.get(clean);
    if (!row) return null;
    if (row.expires < Date.now()) {
      this.cache.delete(clean);
      return null;
    }
    return { buf: row.buf, mime: row.mime };
  }

  /** Alias used by VoiceController */
  getCachedAudio(id: string): { buffer: Buffer; mimeType: string } | null {
    const row = this.getCached(id);
    if (!row) return null;
    return { buffer: row.buf, mimeType: row.mime };
  }

  private prune() {
    const now = Date.now();
    for (const [id, row] of this.cache) {
      if (row.expires < now) this.cache.delete(id);
    }
  }
}
