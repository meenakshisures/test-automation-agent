import { type Page, expect } from '@playwright/test';
import { totp, totpSecondsLeft } from './totp';

export interface Creds {
  username: string;
  password: string;
  totpSecret?: string;
  /** How long to wait for a human to approve a push / type a code when no TOTP secret is set. */
  mfaWaitMs: number;
}

export function credsFromEnv(): Creds {
  const { TEST_USERNAME, TEST_PASSWORD, MFA_TOTP_SECRET, MFA_WAIT_MS } = process.env;
  if (!TEST_USERNAME || !TEST_PASSWORD) {
    throw new Error('Set TEST_USERNAME and TEST_PASSWORD in .env (see .env.example)');
  }
  return {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    totpSecret: MFA_TOTP_SECRET || undefined,
    mfaWaitMs: Number(MFA_WAIT_MS) || 120_000,
  };
}

/**
 * Drives the app's "Sign in with Microsoft" button through the Entra ID flow.
 * Handles: email -> password -> (optional MFA: TOTP code, or manual approval) -> "Stay signed in?".
 * A state machine rather than fixed steps, because Microsoft shows the MFA/KMSI pages conditionally.
 */
export async function loginWithMicrosoft(page: Page, loginUrl: string, c: Creds) {
  const appOrigin = new URL(loginUrl).origin;
  await page.goto(loginUrl);
  await page.getByRole('button', { name: 'Sign in with Microsoft' }).click();

  const deadline = Date.now() + 90_000 + c.mfaWaitMs;
  let usedTotp = false;
  let warnedManual = false;

  while (Date.now() < deadline) {
    const u = new URL(page.url());
    // Back on the app and past the OAuth callback / login route => signed in.
    if (u.origin === appOrigin && !/^\/login/.test(u.pathname) && !u.hash.startsWith('#code=') && u.pathname !== '/') return;

    const email = page.getByPlaceholder(/email, phone, or skype/i);
    const pwd = page.locator('input[type="password"]:visible');
    const otp = page.locator('input[name="otc"]:visible');
    const kmsiNo = page.getByRole('button', { name: 'No' });
    const useCode = page.getByText(/use a verification code|enter a code from your authenticator/i).first();
    const otherOption = page.getByRole('link', { name: /sign in another way|different verification option|can.t use my/i }).first();
    const waitingOnDevice = page.getByText(/approve sign.?in request|check your authenticator|verify your identity/i).first();

    if (await email.isVisible().catch(() => false)) {
      await email.fill(c.username);
      await email.press('Enter'); // Enter, not click: the Next button re-renders mid-click
      await email.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    } else if (await pwd.isVisible().catch(() => false)) {
      await pwd.fill(c.password);
      await pwd.press('Enter');
      await pwd.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    } else if (await otp.isVisible().catch(() => false)) {
      if (c.totpSecret && !usedTotp) {
        if (totpSecondsLeft() < 4) await page.waitForTimeout(5_000); // don't submit a code about to roll over
        await otp.fill(totp(c.totpSecret));
        usedTotp = true;
        await otp.press('Enter');
        await otp.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
      } else if (!warnedManual) {
        warnedManual = true;
        console.log(`[auth] MFA code required but no usable MFA_TOTP_SECRET. Enter it in the browser (waiting up to ${c.mfaWaitMs / 1000}s).`);
      }
    } else if (await kmsiNo.isVisible().catch(() => false)) {
      await kmsiNo.click({ timeout: 5_000 }).catch(() => {});
    } else if (c.totpSecret && !usedTotp && (await useCode.isVisible().catch(() => false))) {
      await useCode.click(); // "Verify your identity" picker -> choose the code option
    } else if (c.totpSecret && !usedTotp && (await otherOption.isVisible().catch(() => false))) {
      await otherOption.click();
    } else if (!c.totpSecret && !warnedManual && (await waitingOnDevice.isVisible().catch(() => false))) {
      warnedManual = true;
      console.log(`[auth] MFA approval required. Approve it on your device (waiting up to ${c.mfaWaitMs / 1000}s). Run headed if a code must be typed.`);
    }

    const err = page.locator('#usernameError, #passwordError, #idTD_Error, #otcError').first();
    if (await err.isVisible().catch(() => false)) {
      throw new Error(`Microsoft login rejected: ${(await err.innerText()).trim()}`);
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Login did not complete (stuck at ${page.url().slice(0, 100)}). If MFA is enabled, set MFA_TOTP_SECRET or run headed.`);
}

export async function expectLoggedIn(page: Page) {
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Dashboard' })).toBeVisible({ timeout: 30_000 });
}
