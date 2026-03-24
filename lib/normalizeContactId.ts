export default function normalizeContactId(id?: string | number | null): string {
  if (id === undefined || id === null) return '';
  const s = String(id).trim();
  // Remove all non-digit characters to normalize phone-like IDs
  const digits = s.replace(/\D/g, '');
  // Fallback to full string if no digits found
  return digits.length > 0 ? digits : s;
}
