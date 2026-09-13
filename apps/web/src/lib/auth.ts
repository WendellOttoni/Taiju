export const authTokenKey = "taiju:auth-token";

export function authenticatedHeaders() {
  const token = localStorage.getItem(authTokenKey);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
