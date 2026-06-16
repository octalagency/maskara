import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const mockPrisma = {
    paymentSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const mockPlans = {
    findByCode: jest.fn(),
    assignPlanToMerchant: jest.fn(),
  };
  const mockSubscriptions = { subscribe: jest.fn(), confirmPayment: jest.fn() };
  const mockBkash = { createPayment: jest.fn(), executePayment: jest.fn() };
  const mockNagad = { createPayment: jest.fn(), verifyCallback: jest.fn() };

  const service = new PaymentsService(
    mockPrisma as never,
    mockPlans as never,
    mockSubscriptions as never,
    mockBkash as never,
    mockNagad as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('initiates bKash payment session', async () => {
    mockPlans.findByCode.mockResolvedValue({
      code: 'GROWTH',
      isActive: true,
      priceMonthly: 4999,
    });
    mockPlans.assignPlanToMerchant.mockResolvedValue({
      billing: { id: 'bill-1' },
    });
    mockBkash.createPayment.mockResolvedValue({
      paymentUrl: 'https://bkash.test/pay',
      gatewayTrxId: 'trx-1',
      provider: 'bkash',
    });
    mockPrisma.paymentSession.create.mockResolvedValue({ id: 'sess-1' });

    const result = await service.initiatePayment('m1', 'GROWTH', 'bkash');

    expect(result.paymentUrl).toBe('https://bkash.test/pay');
    expect(result.provider).toBe('bkash');
    expect(mockPrisma.paymentSession.create).toHaveBeenCalled();
  });
});
