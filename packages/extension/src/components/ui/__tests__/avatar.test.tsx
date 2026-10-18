import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@solidjs/testing-library';

import { Avatar, AvatarFallback, AvatarImage } from '../avatar';

const OriginalImage = window.Image;

afterEach(() => {
  cleanup();
  window.Image = OriginalImage;
});

// happy-dom never loads images, so make the one Kobalte preloads report success
function loadImagesInstantly() {
  window.Image = class {
    onload: (() => void) | null = null;
    #src = '';

    get src() {
      return this.#src;
    }

    set src(value: string) {
      this.#src = value;
      queueMicrotask(() => this.onload?.());
    }
  } as unknown as typeof Image;
}

describe('avatar', () => {
  it('shows the fallback while the image is not loaded', () => {
    render(() => (
      <Avatar class="root" data-testid="avatar">
        <AvatarImage src="https://example.com/avatar.png" alt="Avatar" />
        <AvatarFallback class="fallback">AS</AvatarFallback>
      </Avatar>
    ));

    expect(screen.getByTestId('avatar').className).toContain('rounded-full');
    expect(screen.getByTestId('avatar').className).toContain('root');
    expect(screen.getByText('AS').className).toContain('bg-muted');
    expect(screen.getByText('AS').className).toContain('fallback');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows the image once it loads', async () => {
    loadImagesInstantly();

    render(() => (
      <Avatar>
        <AvatarImage
          class="image"
          src="https://example.com/avatar.png"
          alt="Avatar"
        />
        <AvatarFallback>AS</AvatarFallback>
      </Avatar>
    ));

    const image = await screen.findByRole('img', { name: 'Avatar' });

    expect(image.className).toContain('aspect-square');
    expect(image.className).toContain('image');
    expect(screen.queryByText('AS')).toBeNull();
  });
});
