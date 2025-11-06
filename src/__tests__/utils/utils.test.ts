import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn function', () => {
    it('merges class names correctly', () => {
      expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
    });

    it('handles conditional classes', () => {
      expect(cn('base', true && 'conditional')).toBe('base conditional');
      expect(cn('base', false && 'conditional')).toBe('base');
    });

    it('handles tailwind merge conflicts', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });
  });
});
