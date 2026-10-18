import type { Component } from 'solid-js';
import { Show } from 'solid-js';

import { Button as UiButton } from '~/components/ui/button';
import type { SiteConfig, SitePage } from '~/sites/schema';
import { checkCss } from '~/sites/schema';

import { elementSelector } from '../../logic/selectors';
import { Field, TextArea, Warning } from '../controls';
import { createPicker } from './pick';
import type { Summary } from './types';

const filled = (css: string | undefined) => Boolean(css?.trim());

export function cssSummary(config: SiteConfig, page: SitePage): Summary {
  if ([config.css, page.css].some((css) => css && checkCss(css))) {
    return { text: "Has CSS AniScore can't use", status: 'issue' };
  }

  const where = [
    filled(config.css) && 'the site',
    filled(page.css) && 'this page',
  ].filter(Boolean);

  return {
    text: where.length ? `For ${where.join(' and ')}` : 'None',
    status: 'none',
  };
}

const CssField: Component<{
  label: string;
  hint: string;
  value: string | undefined;
  onChange: (css: string | undefined) => void;
}> = (props) => (
  <div class="flex flex-col gap-1.5">
    <Field label={props.label} hint={props.hint}>
      <TextArea
        class="min-h-28 text-[11px] leading-relaxed"
        wrap="off"
        placeholder=".card { … }"
        value={props.value ?? ''}
        onValue={(css) => props.onChange(css || undefined)}
      />
    </Field>
    <Show when={props.value && checkCss(props.value)}>
      {(problem) => <Warning>{problem()}</Warning>}
    </Show>
  </div>
);

/**
 * CSS of the user's own, for what the other parts don't cover: for every page of the site, and for the page being
 * edited. AniScore adds it after the site's own, while a page with cards is shown.
 */
export const CssPart: Component<{
  config: SiteConfig;
  onChange: (changes: Partial<SiteConfig>) => void;
  page: SitePage;
  onPageChange: (changes: Partial<SitePage>) => void;
}> = (props) => {
  const pick = createPicker();

  // An overlay over the cards takes the pointer, so neither the site's links nor AniScore's details can be used
  async function unblock() {
    const element = await pick();

    if (!element) return;

    props.onChange({
      css: [
        props.config.css,
        `/* Lets clicks and hovers through to the cards */\n${elementSelector(element)} {\n  pointer-events: none !important;\n}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  return (
    <>
      <p class="m-0 text-[13px] leading-normal text-muted-foreground">
        For what the other settings don't cover. AniScore adds it after the
        site's own CSS. Loading anything from elsewhere isn't allowed.
      </p>
      <CssField
        label="Every page of the site"
        hint="While a page with cards is shown"
        value={props.config.css}
        onChange={(css) => props.onChange({ css })}
      />
      <CssField
        label="This page"
        hint="Only while this page applies"
        value={props.page.css}
        onChange={(css) => props.onPageChange({ css })}
      />
      <div class="flex flex-col items-start gap-1">
        <UiButton variant="outline" size="sm" onClick={() => void unblock()}>
          Pick an overlay that blocks the cards
        </UiButton>
        <span class="text-xs text-muted-foreground">
          Adds a rule that lets clicks through it to the cards.
        </span>
      </div>
    </>
  );
};
