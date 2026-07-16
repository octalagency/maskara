/**
 * Call window: always open — first call within ~20s of order, any hour.
 * (Previously 08:00–22:00 Asia/Dhaka; removed per product request.)
 */
export function isWithinCallWindow(
  _timezone = 'Asia/Dhaka',
  _startHour = 0,
  _endHour = 24,
  _now = new Date(),
): boolean {
  return true;
}

export function callWindowLabel(timezone = 'Asia/Dhaka'): string {
  return `২৪ ঘণ্টা — অর্ডারের ~২০ সেকেন্ডের মধ্যে (${timezone})`;
}
