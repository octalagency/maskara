import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VoiceSettingsService } from './voice-settings.service';
import { S3StorageService } from '../common/services/s3-storage.service';

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
    opts?: { languageCode?: string; voiceName?: string },
  ): Promise<Buffer> {
    const result = await this.synthesize(text, opts?.voiceName || 'bn-IN-Chirp3-HD-Algieba');
    return result.buffer;
  }

  async synthesize(
    text: string,
    voiceName = 'bn-IN-Chirp3-HD-Algieba',
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

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: clean },
        voice: { languageCode, name: voiceName },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.95,
          pitch: 0,
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
      `Google TTS ok voice=${voiceName} bytes=${buffer.length} chars=${clean.length}`,
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
    const row = this.cache.get(id);
    if (!row) return null;
    if (row.expires < Date.now()) {
      this.cache.delete(id);
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
