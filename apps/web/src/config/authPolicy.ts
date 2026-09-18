export function isEmailVerificationRequired(): boolean {
  const value = import.meta.env.VITE_AUTH_REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase();
  if (value === "false") return false;
  return false;
}
