import { IntegrationType, Prisma } from '@prisma/client';

export type StoreKey = string; // woo | shopin | shopin:{id} | shopify | other

export type StoreBucket = {
  key: StoreKey;
  label: string;
  source: IntegrationType | 'MIXED';
};

type IntegrationRow = {
  id: string;
  type: IntegrationType;
  name: string;
  credentials: unknown;
  webhookUrl?: string | null;
  isActive?: boolean;
};

type OrderStoreFields = {
  source: IntegrationType;
  metadata: unknown;
  orderNumber?: string | null;
};

function creds(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function meta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/** Connected stores for a merchant (always show even with 0 orders). */
export function connectedStoreBuckets(
  integrations: IntegrationRow[],
): StoreBucket[] {
  const out: StoreBucket[] = [];
  const seen = new Set<string>();

  for (const i of integrations.filter((x) => x.type === 'WOOCOMMERCE')) {
    const c = creds(i.credentials);
    const label =
      String(c.storeName || c.storeUrl || i.name || 'WordPress')
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '') || 'WordPress';
    const key = 'woo';
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ key, label: `WordPress · ${label}`, source: 'WOOCOMMERCE' });
    }
  }

  const shopIns = listShopInIntegrations(integrations);

  // One chip per unique shopId; if none have shopId, one ShopIn chip
  const byShop = new Map<string, StoreBucket>();
  for (const i of shopIns) {
    const c = creds(i.credentials);
    const shopId = String(c.shopId || '').trim();
    const shopName = String(c.shopName || i.name || 'ShopIn').replace(
      /^ShopIn\s+/i,
      '',
    );
    const key = shopId ? `shopin:${shopId}` : 'shopin';
    if (!byShop.has(key)) {
      byShop.set(key, {
        key,
        label: `ShopIn · ${shopName}`,
        source: 'CUSTOM_API',
      });
    }
  }
  // Prefer shopId keys; drop bare "shopin" if any shopin:{id} exists
  const shopKeys = [...byShop.keys()];
  const hasIdKeys = shopKeys.some((k) => k.startsWith('shopin:'));
  for (const [key, b] of byShop) {
    if (hasIdKeys && key === 'shopin') continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(b);
    }
  }

  for (const i of integrations.filter((x) => x.type === 'SHOPIFY')) {
    const key = 'shopify';
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        key,
        label: `Shopify · ${i.name || 'Store'}`,
        source: 'SHOPIFY',
      });
    }
  }

  return out;
}

function listShopInIntegrations(integrations: IntegrationRow[]) {
  return integrations.filter(
    (i) =>
      i.type === 'CUSTOM_API' &&
      (String(creds(i.credentials).provider || '').toLowerCase() === 'shopin' ||
        (i.name || '').toLowerCase().startsWith('shopin') ||
        (i.webhookUrl || '').includes('/webhooks/maskara/')),
  );
}

/** Map one order to a store bucket key + label. */
export function resolveOrderStore(
  order: OrderStoreFields,
  integrations: IntegrationRow[],
): StoreBucket {
  const m = meta(order.metadata);

  if (order.source === 'WOOCOMMERCE') {
    const woo = integrations.find((i) => i.type === 'WOOCOMMERCE');
    const c = creds(woo?.credentials);
    const label =
      String(c.storeName || c.storeUrl || woo?.name || 'WordPress')
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '') || 'WordPress';
    return { key: 'woo', label: `WordPress · ${label}`, source: 'WOOCOMMERCE' };
  }

  if (order.source === 'SHOPIFY') {
    return { key: 'shopify', label: 'Shopify', source: 'SHOPIFY' };
  }

  let shopId = String(m.shopId || m.shop_id || '').trim();
  const isShopIn =
    String(m.provider || '').toLowerCase() === 'shopin' ||
    Boolean(shopId) ||
    String(order.orderNumber || '').startsWith('ORD-');

  if (isShopIn || order.source === 'CUSTOM_API') {
    const shopIns = listShopInIntegrations(integrations);

    // Orders often lack metadata.shopId — bind to the sole connected ShopIn shop
    if (!shopId && shopIns.length === 1) {
      shopId = String(creds(shopIns[0].credentials).shopId || '').trim();
    }
    if (!shopId && shopIns.length > 1) {
      // Prefer integration whose shopName matches metadata, else first
      const named = shopIns.find(
        (i) =>
          String(creds(i.credentials).shopName || '') ===
          String(m.shopName || ''),
      );
      shopId = String(
        creds((named || shopIns[0]).credentials).shopId || '',
      ).trim();
    }

    if (shopId) {
      const match =
        shopIns.find((i) => String(creds(i.credentials).shopId || '') === shopId) ||
        shopIns[0];
      const c = creds(match?.credentials);
      const shopName = String(
        c.shopName || match?.name || m.shopName || 'ShopIn',
      ).replace(/^ShopIn\s+/i, '');
      return {
        key: `shopin:${shopId}`,
        label: `ShopIn · ${shopName}`,
        source: 'CUSTOM_API',
      };
    }

    const shopIn = shopIns[0];
    const c = creds(shopIn?.credentials);
    const shopName = String(c.shopName || shopIn?.name || 'ShopIn').replace(
      /^ShopIn\s+/i,
      '',
    );
    return {
      key: 'shopin',
      label: `ShopIn · ${shopName}`,
      source: 'CUSTOM_API',
    };
  }

  return { key: 'other', label: 'Other', source: order.source };
}

/** Prisma where fragment for a store key (plus JS post-filter when needed). */
export function storeKeyToPrismaFilter(
  storeKey: string | undefined,
): Prisma.OrderWhereInput | null {
  if (!storeKey || storeKey === 'all') return null;
  if (storeKey === 'woo') return { source: 'WOOCOMMERCE' };
  if (storeKey === 'shopify') return { source: 'SHOPIFY' };
  // Bare shopin OR shopin:{id} — ShopIn orders often miss metadata.shopId
  if (storeKey === 'shopin' || storeKey.startsWith('shopin:')) {
    return {
      source: 'CUSTOM_API',
      OR: [
        { orderNumber: { startsWith: 'ORD-' } },
        { metadata: { path: ['provider'], equals: 'shopin' } },
        ...(storeKey.startsWith('shopin:')
          ? [
              {
                metadata: {
                  path: ['shopId'],
                  equals: storeKey.slice('shopin:'.length),
                },
              } as Prisma.OrderWhereInput,
            ]
          : []),
      ],
    };
  }
  if (storeKey === 'other') {
    return {
      NOT: {
        OR: [
          { source: 'WOOCOMMERCE' },
          { source: 'SHOPIFY' },
          { orderNumber: { startsWith: 'ORD-' } },
        ],
      },
    };
  }
  return null;
}
