export type AuthMethod = 'google' | 'guest' | 'email' | null;

export type SignInReason = 'orders' | 'upgrade' | 'session-expired';

export const GOOGLE_POPUP_TIMEOUT_MS = 20_000;

export function isMethodDisabled(activeAuthMethod: AuthMethod, method: Exclude<AuthMethod, null>): boolean {
  return activeAuthMethod === method;
}

export function getSigninReasonMessage(reason: string | null): string | null {
  if (reason === 'orders') {
    return 'Sign in to view your order history and status updates.';
  }
  if (reason === 'upgrade') {
    return 'Upgrade your guest session to save your gallery and order history.';
  }
  if (reason === 'session-expired') {
    return 'Your session expired. Please sign in again to continue.';
  }
  return null;
}

export class AuthTimeoutError extends Error {
  code: string;
  timedOut: boolean;

  constructor(message: string, code = 'auth/popup-timeout') {
    super(message);
    this.code = code;
    this.timedOut = true;
  }
}

export async function withAuthTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new AuthTimeoutError('Authentication popup timed out. Please try again.'));
      }, timeoutMs);
    });

    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
