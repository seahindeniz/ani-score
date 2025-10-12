import type { Component, FlowComponent, JSX, ParentComponent, ParentProps } from 'solid-js'
import type { EpisodeCard } from '../../../site/base'
import type { AnimeDetails } from '~/background/logic/fetchDetails'
import clsx from 'clsx'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import AntDesignTagsFilled from '~icons/ant-design/tags-filled'
import DeviconPlainPlaywright from '~icons/devicon-plain/playwright'
import SvgSpinners3DotsMove from '~icons/svg-spinners/3-dots-move'
import SvgSpinnersPulseRing from '~icons/svg-spinners/pulse-ring'
import { useSettingsStore } from '~/logic'
import styles from './CardDetail.module.scss'
import 'uno.css'

const SubDetail: FlowComponent<{ title: string }> = props => (
  <sup title={props.title} class={styles.subDetail}>
    <sub>{props.children}</sub>
  </sup>
)

// document.createElement
interface DetailProps<TagName extends keyof JSX.IntrinsicElements> {
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

function Detail<TagName extends keyof JSX.IntrinsicElements>(props: ParentProps<DetailProps<TagName>>): JSX.Element {
  return (
    // @ts-expect-error pass all props to Dynamic
    <Dynamic
      component={props.tagName || 'div'}
      class={clsx(styles.detail, props.class)}
      style={props.style}
      title={props.title}
      onClick={props.onClick}
      classList={props.classList}
      {...props.attributes}
    >
      <Show when={props.emoji}>
        <div class="relative inset-0">
          <Show when={props.loading}>
            <SvgSpinnersPulseRing class="pointer-events-none absolute left-[-7px] top-[-4px] h-[32px] w-[32px]" />
          </Show>
          <span>{props.emoji}</span>
        </div>
      </Show>
      {props.text}
      {props.children}
    </Dynamic>
  )
}

const TagContainer: ParentComponent<{
  class?: string
}> = props => (
  <div class={clsx(props.class)}>
    {props.children}
  </div>
)

interface Props {
  card: EpisodeCard
  store: { anime: Record<string, AnimeDetails | null> }
  onRender?: () => Promise<void>
}
export const CardDetail: Component<Props> = (props) => {
  const settingsStore = useSettingsStore()
  const [isMakingFavorite, setMakingFavorite] = createSignal<boolean>(false)
  const [isFavorite, setFavorite] = createSignal<boolean>(false)
  const [softFavoriteAdditionCount, setSoftFavoriteAdditionCount] = createSignal(0)
  const details = createMemo(() => props.store.anime[props.card.title])

  const handleFavoriteClick = async (event: MouseEvent) => {
    event.preventDefault()

    const id = details()?.id

    if (isMakingFavorite() || id == null) {
      return
    }

    try {
      setMakingFavorite(true)

      const { error } = await window.messageGateway.sendMessage('make-anime-favorite', id as number)

      if (!error) {
        setFavorite(!isFavorite())
        setSoftFavoriteAdditionCount(
          count => isFavorite() ? count + 1 : count - 1,
        )
      }
    }
    finally {
      setMakingFavorite(false)
    }
  }

  onMount(() => {
    void props.onRender?.()
    setFavorite(Boolean(props.store.anime[props.card.title]?.isFavourite))
  })

  return (
    <div
      class={styles.container}
      classList={{
        'items-center': details() == null,
      }}
    >
      <Show when={details()} fallback={<SvgSpinners3DotsMove />}>
        <div class={clsx(styles.row, styles.spread)}>
          <Show when={details()?.favourites != null}>
            <Detail
              emoji={isFavorite() ? '💘' : '❤️'}
              class="text-white decoration-none hover:decoration-underline"
              loading={isMakingFavorite()}
              text={details()!.favourites! + softFavoriteAdditionCount()}
              title={isFavorite() ? 'Remove Favorite' : 'Add Favorite'}
              onClick={handleFavoriteClick}
            />
          </Show>
          <Show when={details()?.mediaListEntry}>
            <Detail
              emoji="👀"
              text={details()!.mediaListEntry?.progress}
              title="Watching"
            >
              <SubDetail title="Total released episodes">
                {`/ ${Math.max(
                  details()?.episodes || 0,
                  details()?.nextAiringEpisode?.episode || 0,
                )}`}
              </SubDetail>
            </Detail>
          </Show>
          <Show when={details()?.popularity}>
            <Detail
              tagName="a"
              emoji="📈"
              class="text-white decoration-none hover:decoration-underline"
              text={details()!.popularity?.toLocaleString()}
              title={`Popularity [Visit AniList]\n\n${details()?.description?.replace(/(\n{0,999}<br>\n{0,999})+/g, '\n').replace(/<[^>]+>/g, '')}`}
              onClick={event => event.stopPropagation()}
              attributes={{
                href: `https://anilist.co/anime/${details()!.id}`,
                target: '_blank',
                rel: 'noopener noreferrer',
              }}
            />
          </Show>
        </div>
        <Show when={details()?.genres?.length}>
          <TagContainer class={clsx(styles.row, styles.genres)}>
            <DeviconPlainPlaywright />
            <For each={details()!.genres}>
              {genre => (
                <div style={{ color: settingsStore.data().genreColor[genre!] }}>
                  {genre}
                </div>
              )}
            </For>
          </TagContainer>
        </Show>
        <Show when={details()?.tags?.length}>
          <TagContainer class={clsx(styles.row, styles.genres)}>
            <AntDesignTagsFilled />
            <For each={details()!.tags!.slice(0, 5)}>
              {({ name }) => (
                <div style={{ color: settingsStore.data().tagColor[name!] }}>
                  {name}
                </div>
              )}
            </For>
          </TagContainer>
        </Show>
      </Show>
    </div>
  )
}
