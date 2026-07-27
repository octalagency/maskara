import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlansService } from '../plans/plans.service';

describe('SubscriptionsService.canMakeCall', () => {
  const mockPrisma = {
    merchant: { findUnique: jest.fn() },
    subscription: { findFirst: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn(),
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
      id: 'sub1',
      callLimit: 100,
      callsUsed: 100,
      startsAt: new Date(Date.now() - 86400000),
      endsAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ n: 100 }]);
    mockPrisma.subscription.update.mockResolvedValue({});
    const result = await service.canMakeCall('m1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/কোটা|limit/i);
  });

  it('allows when under limit', async () => {
    mockPrisma.merchant.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    mockPrisma.subscription.findFirst.mockResolvedValue({
      id: 'sub1',
      callLimit: 100,
      callsUsed: 50,
      startsAt: new Date(Date.now() - 86400000),
      endsAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.$queryRaw.mockResolvedValue([{ n: 50 }]);
    mockPrisma.subscription.update.mockResolvedValue({});
    const result = await service.canMakeCall('m1');
    expect(result.allowed).toBe(true);
  });
});
