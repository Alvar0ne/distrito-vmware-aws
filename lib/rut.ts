export function cleanRut(value: string) {
  return value.replace(/[^0-9kK-]/g, "").toUpperCase();
}

export function isValidRutFormat(value: string) {
  const formatted = value.trim().toUpperCase();
  if (!/^\d{7,8}-[0-9K]$/.test(formatted)) return false;

  const clean = formatted.replace("-", "");

  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedValue = 11 - (sum % 11);
  const expected =
    expectedValue === 11 ? "0" : expectedValue === 10 ? "K" : String(expectedValue);

  return verifier === expected;
}
