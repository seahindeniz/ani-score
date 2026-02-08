import type { JSX, ParentProps } from 'solid-js'
import clsx from 'clsx'
import { Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import SvgSpinnersPulseRing from '~icons/svg-spinners/pulse-ring'
import styles from './CardDetail.module.scss'

interface Props<TagName extends keyof JSX.IntrinsicElements> {
  text?: JSX.Element
  emoji?: JSX.Element
  title?: string
  loading?: boolean
  tagName?: TagName
  attributes?: JSX.IntrinsicElements[TagName]
  style?: JSX.CSSProperties
  class?: string
  classList?: JSX.CustomAttributes<JSX.IntrinsicElements[TagName]>['classList']
  onClick?: JSX.EventHandlerUnion<JSX.IntrinsicElements[TagName], MouseEvent, JSX.EventHandler<JSX.IntrinsicElements[TagName], MouseEvent>>
}

export function Chip<TagName extends keyof JSX.IntrinsicElements>(props: ParentProps<Props<TagName>>): JSX.Element {
  return (
    // @ts-expect-error pass all props to Dynamic
    <Dynamic
      component={props.tagName || 'div'}
      class={clsx(styles.detail, props.class)}
      style={props.style}
      title={props.title}
      on:click={props.onClick}
      classList={props.classList}
      {...props.attributes}
    >
      <Show when={props.emoji}>
        <div class="relative">
          <Show when={typeof props.emoji === 'string'} fallback={<>{props.emoji}</>}>
            <span>{props.emoji}</span>
          </Show>
          <Show when={props.loading}>
            <SvgSpinnersPulseRing class="pointer-events-none absolute left-[calc(50%_+_1px)] top-[50%] h-[32px] w-[32px] translate-[-50%]" />
          </Show>
        </div>
      </Show>
      {props.text}
      {props.children}
    </Dynamic>
  )
}
