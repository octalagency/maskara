export type VoiceProviderName = 'twilio' | 'epbx' | 'ippbx' | 'simulate';

export interface InitiateCallParams {
  callId: string;
  to: string;
  storeName: string;
  customerName: string;
  orderNumber: string;
  totalAmount: number;
  merchantId: string;
}

export interface InitiateCallResult {
  providerCallId: string;
  status: 'QUEUED' | 'RINGING';
}

export interface VoiceProvider {
  readonly name: VoiceProviderName;
  isConfigured(): boolean;
  initiateCall(params: InitiateCallParams): Promise<InitiateCallResult>;
}
