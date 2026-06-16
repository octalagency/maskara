import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlansService } from '../plans/plans.service';

describe('SubscriptionsService.canMakeCall', () => {
  const mockPrisma = {
    merchant: { findUnique: jest.fn() },
    subscription: { findFirst: jest.fn(), update: jest.fn() },
  };

  const service = new SubscriptionsService(
    mockPrisma as never,
    {} as PlansService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('blocks suspended merchants', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ status: 'SUSPENDED' });
    const result = await service.canMakeCall('m1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('suspended');
  });

  it('blocks when call limit reached', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    mockPrisma.subscription.findFirst.mockResolvedValue({
      callLimit: 100,
      callsUsed: 100,
      endsAt: new Date(Date.now() + 86400000),
    });
    const result = await service.canMakeCall('m1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('limit');
  });

  it('allows when under limit', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    mockPrisma.subscription.findFirst.mockResolvedValue({
      callLimit: 100,
      callsUsed: 50,
      endsAt: new Date(Date.now() + 86400000),
    });
    const result = await service.canMakeCall('m1');
    expect(result.allowed).toBe(true);
  });
});
