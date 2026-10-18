import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';

import { Choice, ChoiceGroup } from '~/components/ui/choice-group';
import type { SiteField } from '~/sites/schema';

import type { Candidate } from '../../logic/analyze';
import { describeSource } from '../../logic/analyze';

const same = (a: SiteField | undefined, b: SiteField | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The places a field could be read from, to choose one: the editor's suggestions, plus not reading it, another place
 * the setup offers (e.g. the whole text that was picked), and the one set by hand when it's none of these.
 */
export const FieldChoices: Component<{
  label: string;
  candidates: Candidate[];
  field: SiteField | undefined;
  onChange: (field: SiteField | undefined) => void;
  /**
   * What a suggestion reads, as its label.
   */
  describe: (candidate: Candidate) => string;
  /**
   * The option for not reading the field, e.g. "Cards don't show a season".
   */
  none?: string;
  other?: { label: string; description: string; field: SiteField };
}> = (props) => {
  const value = () => {
    const index = props.candidates.findIndex((candidate) =>
      same(candidate.extract, props.field),
    );

    if (index !== -1) return String(index);
    if (props.other && same(props.other.field, props.field)) return 'other';
    if (props.field === undefined) return props.none ? 'none' : undefined;

    return 'custom';
  };

  function choose(choice: string) {
    if (choice === 'none') props.onChange(undefined);
    else if (choice === 'other') props.onChange(props.other!.field);
    else props.onChange(props.candidates[Number(choice)].extract);
  }

  return (
    <ChoiceGroup label={props.label} value={value()} onChange={choose}>
      <For each={props.candidates}>
        {(candidate, index) => (
          <Choice
            value={String(index())}
            label={props.describe(candidate)}
            description={describeSource(candidate)}
          />
        )}
      </For>
      <Show when={props.other}>
        {(other) => (
          <Choice
            value="other"
            label={other().label}
            description={other().description}
          />
        )}
      </Show>
      <Show when={value() === 'custom'}>
        <Choice
          value="custom"
          label="Where you set it"
          description="Under Advanced"
        />
      </Show>
      <Show when={props.none}>
        <Choice value="none" label={props.none!} />
      </Show>
    </ChoiceGroup>
  );
};
