import { render, screen } from '@testing-library/react';
import HomePage from '../app/page';

describe('HomePage', () => {
  it('renders heading and description', () => {
    render(<HomePage />);
    expect(screen.getByText('PhotoPrune')).toBeInTheDocument();
    expect(screen.getByText(/Phase 0 skeleton/)).toBeInTheDocument();
  });
});
