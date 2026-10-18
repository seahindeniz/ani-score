/**
 * Builds selectors from the elements a user picks. Sites built with frameworks put generated class names on their
 * elements (Svelte and Emotion hashes, CSS modules, utility classes), which change with every deploy or say nothing
 * about the element, so they're left out or reduced to their stable part.
 */

// `home_recent-card__WB7YR`: the CSS module's name and class, then a hash. The hash has a digit or a capital letter,
// which sets it apart from a BEM element of five letters (`anime-card__title`)
const cssModuleClass = /^(.+__)(?=[\w-]*[A-Z0-9])[A-Za-z0-9_-]{5}$/;

const generatedClass =
  /^(svelte-[a-z0-9]+|css-[a-z0-9]+|sc-[A-Za-z]+|jsx-\d+|ng-[a-z-]+|_[A-Za-z0-9_]{5,})$/;

// Utility classes (Tailwind, UnoCSS, Bootstrap) describe looks, not what the element is
const utilityClass =
  /[:/[\]().%!]|^-?(m|p|[mp][xytrbl]|w|h|size|min|max|gap|space|text|font|leading|tracking|bg|border|rounded|shadow|opacity|z|top|left|right|bottom|inset|overflow|object|aspect|flex|grid|col|row|items|justify|self|content|place|order|basis|grow|shrink|line-clamp|truncate|ring|outline|transition|duration|ease|delay|animate|transform|translate|scale|rotate|cursor|select|pointer-events|sr|block|inline|hidden|visible|relative|absolute|fixed|sticky|static|isolate|group|peer|dark|container|d|align|float|clearfix|fs|fw|lh)(-|$)/;

const escape = (value: string) => CSS.escape(value);

/**
 * The parts of an element's classes that identify it, as selector fragments.
 */
export function stableClasses(element: Element) {
  return Array.from(element.classList).flatMap((name) => {
    const module = cssModuleClass.exec(name);

    if (module) return [`[class*="${module[1]}"]`];
    if (generatedClass.test(name) || utilityClass.test(name)) return [];

    return [`.${escape(name)}`];
  });
}

// Ids that look generated (numbers, hashes) change between pages
const stableId = (id: string) =>
  /^[A-Za-z][\w-]*$/.test(id) && !/\d{3,}|[a-f0-9]{8,}/i.test(id);

/**
 * A selector for an element on its own: its id when that looks stable, else its tag and up to two stable classes.
 */
export function elementSelector(element: Element) {
  if (element.id && stableId(element.id)) return `#${escape(element.id)}`;

  return element.localName + stableClasses(element).slice(0, 2).join('');
}

const similarSiblings = (element: Element, selector: string) =>
  Array.from(element.parentElement?.children ?? []).filter((sibling) =>
    sibling.matches(selector),
  ).length;

/**
 * From an element inside a card, the card itself: the ancestor that repeats the most among its siblings (grid cells
 * outnumber the tags inside a card and the sections of a page). Returns a selector for every such card, scoped to
 * their container, or `undefined` when nothing around the element repeats.
 */
export function generalizeCardSelector(picked: Element) {
  let best: { element: Element; selector: string; count: number } | undefined;

  for (
    let element: Element | null = picked;
    element?.parentElement && element !== document.body;
    element = element.parentElement
  ) {
    const selector = elementSelector(element);
    const count = similarSiblings(element, selector);

    // Ties go to the outer element: a card wrapper repeats as often as the card in it
    if (count >= 2 && count >= (best?.count ?? 0)) {
      best = { element, selector, count };
    }
  }

  if (!best) return undefined;

  return `${elementSelector(best.element.parentElement!)} > ${best.selector}`;
}

/**
 * A selector for `target` relative to `card` (`card.querySelector` finds it), as short as it can be.
 */
export function relativeSelector(card: Element, target: Element) {
  if (card === target) return '';

  const steps: string[] = [];

  for (
    let element: Element | null = target;
    element && element !== card;
    element = element.parentElement
  ) {
    steps.unshift(elementSelector(element));

    const selector = steps.join(' > ');

    if (card.querySelector(selector) === target) return selector;
  }

  // The same path also leads to an earlier element: spell out the position of each step
  const path: string[] = [];

  for (
    let element: Element = target;
    element !== card;
    element = element.parentElement!
  ) {
    const position =
      Array.from(element.parentElement!.children).indexOf(element) + 1;

    path.unshift(`${elementSelector(element)}:nth-child(${position})`);
  }

  return `:scope > ${path.join(' > ')}`;
}

/**
 * A path pattern for the current page: numeric segments (page numbers, ids) become `\d+`.
 */
export function suggestPathPattern(pathname: string) {
  const pattern = pathname
    .split('/')
    .map((segment) =>
      /^\d+$/.test(segment)
        ? '\\d+'
        : segment
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\d+/g, '\\d+'),
    )
    .join('/');

  return `^${pattern}$`;
}
