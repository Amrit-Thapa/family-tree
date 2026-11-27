import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mockVerifySession = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  verifySession: () => mockVerifySession(),
}));

import LandingPage from './page';

async function renderLanding(): Promise<string> {
  return renderToStaticMarkup(await LandingPage());
}

describe('LandingPage', () => {
  beforeEach(() => {
    mockVerifySession.mockReset();
  });

  it('shows the sign-in call to action for signed-out visitors', async () => {
    mockVerifySession.mockResolvedValue(null);
    const html = await renderLanding();

    expect(html).toContain('Know exactly how you’re related.');
    expect(html).toContain('href="/auth/signin"');
    expect(html).toContain('Get started with Google');
    expect(html).not.toContain('Go to your dashboard');
  });

  it('shows the dashboard call to action for signed-in users', async () => {
    mockVerifySession.mockResolvedValue({ userId: 'user-1' });
    const html = await renderLanding();

    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('Go to your dashboard');
    expect(html).not.toContain('Get started with Google');
  });

  it('falls back to the signed-out view when the session lookup fails', async () => {
    mockVerifySession.mockRejectedValue(new Error('database unavailable'));
    const html = await renderLanding();

    expect(html).toContain('Get started with Google');
  });

  it('renders the how-it-works and features sections with in-page anchors', async () => {
    mockVerifySession.mockResolvedValue(null);
    const html = await renderLanding();

    expect(html).toContain('id="how-it-works"');
    expect(html).toContain('id="features"');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('Coming soon');
  });
});
