import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';
import {
  InitiateCallParams,
  InitiateCallResult,
  VoiceProvider,
} from './voice-provider.interface';

@Injectable()
export class TwilioProvider implements VoiceProvider {
  readonly name = 'twilio' as const;
  private readonly logger = new Logger(TwilioProvider.name);
  private client: twilio.Twilio | null = null;
  private fromNumber: string;
  private apiUrl: string;

  constructor(private config: ConfigService) {
    const sid = this.config.get('TWILIO_ACCOUNT_SID');
    const token = this.config.get('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.config.get('TWILIO_PHONE_NUMBER', '');
    this.apiUrl =
      this.config.get('PUBLIC_API_URL') ||
      this.config.get('API_URL', 'http://localhost:4000');

    if (sid && token) {
      this.client = twilio(sid, token);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.fromNumber);
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  async initiateCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    if (!this.client) throw new Error('Twilio not configured');

    const twilioCall = await this.client.calls.create({
      to: params.to,
      from: this.fromNumber,
      url: `${this.apiUrl}/voice/twiml/${params.callId}`,
      statusCallback: `${this.apiUrl}/voice/status/${params.callId}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      record: true,
      recordingStatusCallback: `${this.apiUrl}/voice/recording/${params.callId}`,
      timeout: 30,
      machineDetection: 'Enable',
    });

    this.logger.log(`Twilio call: ${twilioCall.sid}`);
    return { providerCallId: twilioCall.sid, status: 'RINGING' };
  }
}
