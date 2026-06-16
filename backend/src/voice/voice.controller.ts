import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  Body,
  Header,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { VoiceService } from './voice.service';
import { VoiceWebhookService } from './voice-webhook.service';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceWebhookGuard } from '../common/guards/voice-webhook.guard';
import { TwilioWebhookGuard } from '../common/guards/twilio-webhook.guard';

@ApiTags('Voice')
@Controller('voice')
export class VoiceController {
  constructor(
    private voiceService: VoiceService,
    private webhooks: VoiceWebhookService,
    private prisma: PrismaService,
  ) {}

  @Get('provider')
  @ApiOperation({ summary: 'Active voice provider info' })
  getProvider() {
    return this.voiceService.getActiveProviderInfo();
  }

  // --- Twilio TwiML (legacy) ---
  @Get('twiml/:callId')
  @Header('Content-Type', 'text/xml')
  @ApiExcludeEndpoint()
  async getTwiml(@Param('callId') callId: string, @Res() res: Response) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { merchant: true },
    });
    const storeName =
      call?.merchant.storeNameBangla || call?.merchant.name || 'স্টোর';
    res.send(this.voiceService.generateTwiml(callId, storeName));
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
  @Post('webhook/epbx')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxWebhook(@Body() body: Record<string, unknown>) {
    const callId = this.webhooks.extractCallId(body);
    const digits = this.webhooks.extractDigits(body);
    if (callId && digits) {
      return this.webhooks.processDtmf(callId, digits);
    }
    if (callId) {
      const status = this.webhooks.extractStatus(body);
      if (status) {
        const duration = Number(body.duration || body.call_duration || 0) || undefined;
        return this.webhooks.processStatus(callId, status, duration);
      }
    }
    return { received: true };
  }

  @Post('webhook/epbx/dtmf')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxDtmf(@Body() body: Record<string, unknown>) {
    const callId = this.webhooks.extractCallId(body);
    const digits = this.webhooks.extractDigits(body);
    if (callId && digits) return this.webhooks.processDtmf(callId, digits);
    return { received: true };
  }

  @Post('webhook/epbx/status')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async epbxStatus(@Body() body: Record<string, unknown>) {
    const callId = this.webhooks.extractCallId(body);
    const status = this.webhooks.extractStatus(body);
    if (callId && status) {
      const duration = Number(body.duration || 0) || undefined;
      return this.webhooks.processStatus(callId, status, duration);
    }
    return { received: true };
  }

  // --- ippbx.com.bd webhooks ---
  @Post('webhook/ippbx')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxWebhook(@Body() body: Record<string, unknown>) {
    return this.epbxWebhook(body);
  }

  @Post('webhook/ippbx/dtmf')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxDtmf(@Body() body: Record<string, unknown>) {
    return this.epbxDtmf(body);
  }

  @Post('webhook/ippbx/status')
  @UseGuards(VoiceWebhookGuard)
  @ApiExcludeEndpoint()
  async ippbxStatus(@Body() body: Record<string, unknown>) {
    return this.epbxStatus(body);
  }
}
