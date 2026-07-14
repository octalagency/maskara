import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { VoiceSettingsService } from './voice-settings.service';
import { S3StorageService } from '../common/services/s3-storage.service';
import {
  DEFAULT_SPEECH_RATE,
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_VOLUME_GAIN_DB,
  toChirpExpressiveMarkup,
} from './providers/bangla-prompt';

const REDIS_TTS_PREFIX = 'maskara:tts-audio:';
const REDIS_TTS_TTL_SEC = 15 * 60;

@Injectable()
export class GoogleTtsService implements OnModuleDestroy {
  private readonly logger = new Logger(GoogleTtsService.name);
  /** Process-local L1 cache (same process only — worker≠API). */
  private readonly cache = new Map<
    string,
    { buf: Buffer; mime: string; expires: number }
  >();
  private redis: Redis | null = null;

  constructor(
    private settings: VoiceSettingsService,
    private s3: S3StorageService,
    private config: ConfigService,
  ) {
    const redisUrl =
      this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
      });
      this.redis.on('error', (err) => {
        this.logger.warn(
          `Redis TTS cache error: ${err instanceof Error ? err.message : err}`,
        );
      });
    } catch (err) {
      this.logger.warn(
        `Redis TTS cache unavailable: ${err instanceof Error ? err.message : err}`,
      );
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
      this.redis = null;
    }
  }

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
   * Host MP3 for ePBX to download.
   * Prefer S3; else Redis (shared worker↔API) + public /voice/tts-audio/:id URL.
   * Never rely on process memory alone — Hostinger runs synthesize on worker
   * while ePBX fetches from the API container.
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
      if (url) {
        this.logger.log(`TTS hosted on S3 label=${merchantId} bytes=${buffer.length}`);
        return url;
      }
      this.logger.warn('S3 upload failed — falling back to Redis TTS host');
    }

    const id = await this.storeSharedAudio(buffer, mime);
    const url = `${this.publicApiBase()}/voice/tts-audio/${id}`;
    this.logger.log(
      `TTS hosted via Redis/API label=${merchantId} id=${id} bytes=${buffer.length} url=${url.slice(0, 96)}`,
    );
    return url;
  }

  /** Write to L1 + Redis so worker-generated audio is fetchable by API. */
  private async storeSharedAudio(
    buffer: Buffer,
    mimeType = 'audio/mpeg',
    ttlMs = REDIS_TTS_TTL_SEC * 1000,
  ): Promise<string> {
    this.prune();
    const id = randomUUID();
    this.cache.set(id, {
      buf: buffer,
      mime: mimeType,
      expires: Date.now() + ttlMs,
    });

    if (this.redis) {
      try {
        // Pack mime + mp3 so API can restore content-type
        const packed = Buffer.concat([
          Buffer.from(`${mimeType}\n`, 'utf8'),
          buffer,
        ]);
        await this.redis.setex(
          `${REDIS_TTS_PREFIX}${id}`,
          REDIS_TTS_TTL_SEC,
          packed,
        );
      } catch (err) {
        this.logger.error(
          `Failed to store TTS in Redis — ePBX may 404 audio: ${err instanceof Error ? err.message : err}`,
        );
      }
    } else {
      this.logger.error(
        'Redis unavailable for TTS host — audio URL will 404 on other processes',
      );
    }

    return id;
  }

  /** @deprecated use storeSharedAudio — kept for callers that only need local id */
  cacheAudio(buffer: Buffer, mimeType = 'audio/mpeg', ttlMs = 15 * 60 * 1000): string {
    this.prune();
    const id = randomUUID();
    this.cache.set(id, { buf: buffer, mime: mimeType, expires: Date.now() + ttlMs });
    // Fire-and-forget Redis write without awaiting (legacy sync API)
    if (this.redis) {
      const packed = Buffer.concat([Buffer.from(`${mimeType}\n`, 'utf8'), buffer]);
      void this.redis
        .setex(`${REDIS_TTS_PREFIX}${id}`, Math.ceil(ttlMs / 1000), packed)
        .catch((err) =>
          this.logger.warn(
            `Redis cacheAudio write failed: ${err instanceof Error ? err.message : err}`,
          ),
        );
    }
    return id;
  }

  async getCached(id: string): Promise<{ buf: Buffer; mime: string } | null> {
    const clean = id.replace(/\.mp3$/i, '');
    const local = this.cache.get(clean);
    if (local) {
      if (local.expires < Date.now()) {
        this.cache.delete(clean);
      } else {
        return { buf: local.buf, mime: local.mime };
      }
    }

    if (!this.redis) return null;
    try {
      const packed = await this.redis.getBuffer(`${REDIS_TTS_PREFIX}${clean}`);
      if (!packed || packed.length < 8) return null;
      const nl = packed.indexOf(0x0a); // \n
      if (nl <= 0 || nl > 64) return null;
      const mime = packed.subarray(0, nl).toString('utf8') || 'audio/mpeg';
      const buf = packed.subarray(nl + 1);
      if (buf.length < 64) return null;
      // Warm L1 for repeat fetches (ePBX may retry)
      this.cache.set(clean, {
        buf,
        mime,
        expires: Date.now() + REDIS_TTS_TTL_SEC * 1000,
      });
      return { buf, mime };
    } catch (err) {
      this.logger.warn(
        `Redis TTS get failed id=${clean}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** Alias used by VoiceController */
  async getCachedAudio(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const row = await this.getCached(id);
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
