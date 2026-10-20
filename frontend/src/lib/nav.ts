/**
 * Navigate to the booking home screen. Clears any saved confirmation so the
 * logo always lands on the fresh booking page (not a restored confirmation).
 */
export function goHome(e?: { preventDefault?: () => void }): void {
  e?.preventDefault?.();
  try {
    sessionStorage.removeItem('cy_confirmation');
  } catch {
    /* ignore storage errors */
  }
  window.location.href = '/';
}
