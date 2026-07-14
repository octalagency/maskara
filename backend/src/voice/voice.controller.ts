import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  Body,
  Query,
  Header,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { VoiceService } from './voice.service';
import { VoiceWebhookService } from './voice-webhook.service';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceWebhookGuard } from '../common/guards/voice-webhook.guard';
import { TwilioWebhookGuard } from '../common/guards/twilio-webhook.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TtsPreviewService } from './tts-preview.service';
import { GoogleTtsService } from './google-tts.service';
import { VoiceSettingsService } from './voice-settings.service';

@ApiTags('Voice')
@Controller('voice')
export class VoiceController {
  constructor(
    private voiceService: VoiceService,
    private webhooks: VoiceWebhookService,
    private prisma: PrismaService,
    private ttsPreview: TtsPreviewService,
    private googleTts: GoogleTtsService,
    private voiceSettings: VoiceSettingsService,
  ) {}

  @Get('provider')
  @ApiOperation({ summary: 'Active voice provider info' })
  getProvider() {
    return {
      ...this.voiceService.getActiveProviderInfo(),
      googleTts: this.voiceSettings.isGoogleTtsConfigured(),
      recommendedVoice: this.voiceSettings.isGoogleTtsConfigured()
        ? 'google:bn-IN-Chirp3-HD-Algieba'
        : 'azure:bn-BD-PradeepNeural',
    };
  }

  @Get('tts-audio/:id')
  @ApiExcludeEndpoint()
  async serveTtsAudio(@Param('id') id: string, @Res() res: Response) {
    const audio = await this.googleTts.getCached(id);
    if (!audio) throw new NotFoundException('Audio expired or not found');
    res.setHeader('Content-Type', audio.mime);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(audio.buf);
  }

  @Post('preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate Bangla TTS preview audio for settings' })
  async preview(@Body() body: { text?: string; voiceId?: string; speechRate?: number }) {
    const text = (body.text || '').trim();
    if (!text) throw new BadRequestException('text required');
    try {
      return await this.ttsPreview.synthesize(text, body.voiceId, body.speechRate);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Preview failed',
      );
    }
  }

  // --- Twilio TwiML (legacy) ---
  @Get('twiml/:callId')
  @Header('Content-Type', 'text/xml')
  @ApiExcludeEndpoint()
  async getTwiml(@Param('callId') callId: string, @Res() res: Response) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { merchant: true, order: true },
    });
    const storeName =
      call?.merchant.storeNameBangla || call?.merchant.name || 'স্টোর';
    res.send(
      this.voiceService.generateTwiml(callId, {
        storeName,
        customerName: call?.order?.customerName,
        orderNumber: call?.order?.orderNumber,
        totalAmount:
          call?.order?.totalAmount != null
            ? Number(call.order.totalAmount)
            : undefined,
        customGreeting: call?.merchant.customGreeting,
      }),
    );
  }

  @Post('gather/:callId')
  @UseGuards(TwilioWebhookGuard)
  @Header('Content-Type', 'text/xml')
  @ApiExcludeEndpoint()
  async handleGather(
    @Param('callId') callId: string,
    @Body('Digits') digits: string,
    @Res() res: Response,
  ) {
    const twiml = await this.voiceService.handleDtmfInput(callId, digits || '');
    res.send(twiml);
  }

  @Post('status/:callId')
  @UseGuards(TwilioWebhookGuard)
  @ApiExcludeEndpoint()
  async handleStatus(
    @Param('callId') callId: string,
    @Body('CallStatus') status: string,
    @Body('CallDuration') duration: string,
  ) {
    await this.voiceService.handleCallStatus(callId, status, duration);
    return { received: true };
  }

  @Post('recording/:callId')
  @UseGuards(TwilioWebhookGuard)
  @ApiExcludeEndpoint()
  async handleRecording(
    @Param('callId') callId: string,
    @Body('RecordingUrl') recordingUrl: string,
  ) {
    await this.voiceService.handleRecording(callId, recordingUrl);
    return { received: true };
  }

  // --- ePBX.bd webhooks ---
  @Get('webhook/epbx')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxWebhookGet(@Query() query: Record<string, unknown>) {
    return this.webhooks.handleEpbxPayload(query);
  }

  @Post('webhook/epbx')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxWebhook(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    return this.webhooks.handleEpbxPayload({ ...query, ...body });
  }

  @Get('webhook/epbx/dtmf')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxDtmfGet(@Query() query: Record<string, unknown>) {
    return this.webhooks.handleEpbxPayload(query);
  }

  @Post('webhook/epbx/dtmf')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxDtmf(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    return this.webhooks.handleEpbxPayload({ ...query, ...body });
  }

  @Get('webhook/epbx/status')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxStatusGet(@Query() query: Record<string, unknown>) {
    return this.webhooks.handleEpbxPayload(query);
  }

  @Post('webhook/epbx/status')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxStatus(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    return this.webhooks.handleEpbxPayload({ ...query, ...body });
  }

  // --- ippbx.com.bd webhooks ---
  @Get('webhook/ippbx')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxWebhookGet(@Query() query: Record<string, unknown>) {
    return this.webhooks.handleEpbxPayload(query);
  }

  @Post('webhook/ippbx')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxWebhook(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    return this.webhooks.handleEpbxPayload({ ...query, ...body });
  }

  @Get('webhook/ippbx/dtmf')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxDtmfGet(@Query() query: Record<string, unknown>) {
    return this.webhooks.handleEpbxPayload(query);
  }

  @Post('webhook/ippbx/dtmf')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxDtmf(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    return this.webhooks.handleEpbxPayload({ ...query, ...body });
  }

  @Get('webhook/ippbx/status')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxStatusGet(@Query() query: Record<string, unknown>) {
    return this.webhooks.handleEpbxPayload(query);
  }

  @Post('webhook/ippbx/status')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxStatus(
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    return this.webhooks.handleEpbxPayload({ ...query, ...body });
  }
}
