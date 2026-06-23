export function isPasswordAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PASSWORD_AUTH === 'true';
}
