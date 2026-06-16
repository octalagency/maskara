export function buildOrderVerificationPrompt(params: {
  storeName: string;
  customerName?: string;
  orderNumber?: string;
  totalAmount?: number;
}): string {
  const store = params.storeName || 'স্টোর';
  const name = params.customerName ? `${params.customerName}, ` : '';
  const amount =
    params.totalAmount != null
      ? ` ${params.totalAmount} টাকার`
      : '';

  return (
    `আসসালামু আলাইকুম। ${name}আপনি ${store} থেকে${amount} একটি অর্ডার করেছেন। ` +
    `অর্ডারটি নিশ্চিত করতে ১ চাপুন। অর্ডার বাতিল করতে ২ চাপুন। ` +
    `একজন প্রতিনিধির সাথে কথা বলতে ০ চাপুন।`
  );
}
