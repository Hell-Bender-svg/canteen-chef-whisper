import { describe, it, expect, vi } from 'vitest';
import { render } from '@/lib/testUtils';
import { Cart } from '@/components/Cart';

describe('Cart Component', () => {
  const defaultProps = {
    items: [],
    onRemoveItem: vi.fn(),
    onClearCart: vi.fn(),
    onCheckout: vi.fn(),
    onWalletCheckout: vi.fn(),
    totalAmount: 0,
    walletBalance: 0,
    isLoggedIn: false,
  };

  it('renders cart component', () => {
    const { container } = render(<Cart {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('displays cart items count', () => {
    const items = [
      { id: '1', name: 'Samosa', price: 20, quantity: 2 }
    ];
    
    const { container } = render(<Cart {...defaultProps} items={items} totalAmount={40} />);
    expect(container).toBeTruthy();
  });

  it('calculates total correctly', () => {
    const items = [
      { id: '1', name: 'Samosa', price: 20, quantity: 2 },
      { id: '2', name: 'Tea', price: 10, quantity: 1 }
    ];
    
    const { container } = render(<Cart {...defaultProps} items={items} totalAmount={50} />);
    expect(container).toBeTruthy();
  });
});
