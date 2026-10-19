import { render, screen } from '@testing-library/react';
import { Toaster } from './sonner';

describe('Toaster', () => {
  it('anuncia a área dos avisos em português', () => {
    render(<Toaster />);

    const area = screen.getByRole('region', { name: /^Avisos/ });
    expect(area).not.toHaveAccessibleName(/Notifications/);
  });
});
