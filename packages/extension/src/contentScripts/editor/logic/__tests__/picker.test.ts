import { describe, expect, it, mock } from 'bun:test';

import { hoverAttribute, pickElement } from '../picker';

function page() {
  document.body.innerHTML = `
    <div class="editor"><button>Editor</button></div>
    <article class="card"><a href="/episode/1"><h3>Frieren</h3></a></article>
    <footer>Outside</footer>`;

  return {
    editor: document.querySelector('.editor')!,
    title: document.querySelector('h3')!,
    link: document.querySelector('a')!,
    footer: document.querySelector('footer')!,
  };
}

const ignoreEditor = (element: Element) => element.closest('.editor') != null;

describe('pickElement', () => {
  it('marks the element under the pointer, and resolves with the one clicked', async () => {
    const { title, footer } = page();
    const picked = pickElement({ ignore: ignoreEditor });

    title.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(title.hasAttribute(hoverAttribute)).toBe(true);

    footer.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(title.hasAttribute(hoverAttribute)).toBe(false);
    expect(footer.hasAttribute(hoverAttribute)).toBe(true);

    footer.click();

    expect(await picked).toBe(footer);
    expect(footer.hasAttribute(hoverAttribute)).toBe(false);
  });

  it("keeps the click from the site, so a link doesn't navigate", async () => {
    const { title, link } = page();
    const onSiteClick = mock();
    const onSitePress = mock();

    link.addEventListener('click', onSiteClick);
    link.addEventListener('mousedown', onSitePress);

    const picked = pickElement({ ignore: ignoreEditor });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });

    title.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    );
    title.dispatchEvent(click);

    expect(await picked).toBe(title);
    expect(click.defaultPrevented).toBe(true);
    expect(onSiteClick).not.toHaveBeenCalled();
    expect(onSitePress).not.toHaveBeenCalled();

    // Picking is over, so clicks reach the site again
    title.click();
    expect(onSiteClick).toHaveBeenCalledTimes(1);
  });

  it('leaves the ignored elements and the unpickable ones alone', async () => {
    const { editor, title } = page();
    const onEditorClick = mock();

    editor.addEventListener('click', onEditorClick);

    const picked = pickElement({
      ignore: ignoreEditor,
      // Only elements in a card
      resolve: (element) => (element.closest('.card') ? element : null),
    });

    editor.querySelector('button')!.click();
    document.querySelector('footer')!.click();
    document
      .querySelector('footer')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    editor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(onEditorClick).toHaveBeenCalledTimes(1);
    expect(editor.hasAttribute(hoverAttribute)).toBe(false);

    title.click();

    expect(await picked).toBe(title);
  });

  it('ignores events from things other than elements', async () => {
    page();

    const picked = pickElement({ ignore: ignoreEditor });

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(await picked).toBeUndefined();
  });
});
