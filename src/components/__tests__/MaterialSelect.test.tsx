// @vitest-environment jsdom
/** Backlog — searchable material combobox. */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MaterialSelect } from '../MaterialSelect';
import { useCalcStore } from '../../store/useCalcStore';

afterEach(cleanup);
beforeEach(() => useCalcStore.getState().setMaterial('al-6061'));

describe('MaterialSelect combobox', () => {
  it('filters by search and selects via click', () => {
    render(<MaterialSelect />);
    const box = screen.getByRole('combobox', { name: 'Material' });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: '304' } });
    const option = screen.getByText(/stainless 304/i);
    fireEvent.click(option);
    expect(useCalcStore.getState().materialId).toBe('ss-304');
  });

  it('keyboard: arrows + Enter select; Escape closes', () => {
    render(<MaterialSelect />);
    const box = screen.getByRole('combobox', { name: 'Material' });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'titanium' } });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(useCalcStore.getState().materialId).toMatch(/ti/);
  });

  it('no matches shows an empty state, not a crash', () => {
    render(<MaterialSelect />);
    const box = screen.getByRole('combobox', { name: 'Material' });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'unobtainium' } });
    expect(screen.getByText(/no materials match/i)).toBeInTheDocument();
  });
});
