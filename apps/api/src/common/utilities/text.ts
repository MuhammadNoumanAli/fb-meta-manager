/** Trim optional profile input and treat an empty string as "clear the field". */
export const normalizeOptionalText = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
