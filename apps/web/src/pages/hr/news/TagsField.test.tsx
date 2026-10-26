import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TagsField } from './TagsField';

function Harness({ onTags }: { onTags: (tags: string[]) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <TagsField
        value={tags}
        onChange={(next) => {
          setTags(next);
          onTags(next);
        }}
      />
    </QueryClientProvider>
  );
}

afterEach(cleanup);

describe('TagsField with a Vietnamese input method', () => {
  it('should not add a tag when Enter only confirms the word being composed (Telex/VNI)', () => {
    // Arrange
    let tags: string[] = [];
    render(<Harness onTags={(t) => (tags = t)} />);
    const input = screen.getByRole('combobox');

    // Act: the IME is still composing "sống" when Enter is pressed to confirm it.
    fireEvent.change(input, { target: { value: 'đời sống' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });

    // Assert
    expect(tags).toEqual([]);
    expect((input as HTMLInputElement).value).toBe('đời sống');
  });

  it('should add the whole phrase as one tag on the next Enter', () => {
    let tags: string[] = [];
    render(<Harness onTags={(t) => (tags = t)} />);
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'đời sống' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(tags).toEqual(['đời sống']);
  });

  it('should not delete the last tag when Backspace edits a composed letter', () => {
    let tags: string[] = [];
    render(<Harness onTags={(t) => (tags = t)} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'tuyển dụng' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.keyDown(input, { key: 'Backspace', isComposing: true, keyCode: 229 });

    expect(tags).toEqual(['tuyển dụng']);
  });
});
