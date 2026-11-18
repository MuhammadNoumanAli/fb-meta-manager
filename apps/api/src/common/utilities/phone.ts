/**
 * WhatsApp addresses are compared and stored as digits only. The original
 * formatting is displayed from the stored value with a leading plus sign.
 */
export function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/[^\d]/g, '');

  return digits.length >= 6 ? digits : null;
}

export function displayPhone(phone: string): string {
  return phone.startsWith('+') ? phone : `+${phone}`;
}
