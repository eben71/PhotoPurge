import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import HealthPage from '../app/health/page';

const mockFetch = vi.fn();

global.fetch = mockFetch as unknown as typeof fetch;

describe('HealthPage', () => {
  it('shows health status from API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' })
    } as Response);

    render(<HealthPage />);

    await waitFor(() =>
      expect(screen.getByTestId('health-status')).toHaveTextContent('ok')
    );
  });
});
