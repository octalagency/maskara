import { verifyHmacSha256, verifySharedSecret } from './webhook-signature.util';

describe('webhook-signature.util', () => {
  const secret = 'test-secret-key';
  const payload = '{"id":101,"total":"1500"}';

  it('verifies valid HMAC signature', () => {
    const crypto = require('crypto');
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyHmacSha256(payload, sig, secret)).toBe(true);
  });

  it('rejects invalid HMAC signature', () => {
    expect(verifyHmacSha256(payload, 'bad-sig', secret)).toBe(false);
  });

  it('verifies shared secret header', () => {
    expect(verifySharedSecret('my-secret', 'my-secret')).toBe(true);
    expect(verifySharedSecret('wrong', 'my-secret')).toBe(false);
  });
});
