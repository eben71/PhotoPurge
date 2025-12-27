'use client';

import { useEffect, useState } from 'react';

import { HealthStatusSchema } from '@photoprune/shared';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export default function HealthPage() {
  const [status, setStatus] = useState<string>('loading');

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch(`${API_BASE_URL}/healthz`);
        if (!res.ok) {
          throw new Error('Health check failed');
        }
        const data = await res.json();
        const parsed = HealthStatusSchema.parse(data);
        setStatus(parsed.status ?? 'unknown');
      } catch (error) {
        console.error('Health check error', error);
        setStatus('error');
      }
    }

    fetchHealth();
  }, []);

  return (
    <section>
      <h1>API Health</h1>
      <p data-testid="health-status">Status: {status}</p>
    </section>
  );
}
