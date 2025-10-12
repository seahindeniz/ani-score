import type { Component, FlowComponent, JSX, ParentComponent, ParentProps } from 'solid-js'
import type { EpisodeCard } from '../../../site/base'
import type { fetchDetails } from '~/background/logic/fetchDetails'
import clsx from 'clsx'
import { createMemo, createSignal, For, Match, onMount, Show, Switch } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import AntDesignTagsFilled from '~icons/ant-design/tags-filled'
import DeviconPlainPlaywright from '~icons/devicon-plain/playwright'
import LineMdHeartFilled from '~icons/line-md/heart-filled'
import MdiHeart from '~icons/mdi/heart'
import StreamlineFreehandServerError404NotFound from '~icons/streamline-freehand/server-error-404-not-found'
import SvgSpinners3DotsMove from '~icons/svg-spinners/3-dots-move'
import SvgSpinnersPulseRing from '~icons/svg-spinners/pulse-ring'
import { useSettingsStore } from '~/logic'
import { isTrending } from '~/utils/isTrending'
import styles from './CardDetail.module.scss'
import 'uno.css'

const SubDetail: FlowComponent<{ title: string }> = props => (
  <div
    title={props.title}
    class={clsx('align-self text-sm', styles.subDetail)}
    style={{ 'align-self': 'start', 'line-height': '1.5em', 'font-size': '0.8em' }}
  >
    {props.children}
  </div>
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
        <Show when={typeof props.emoji === 'string'} fallback={<>{props.emoji}</>}>
          <div class="relative inset-0">
            <Show when={props.loading}>
              <SvgSpinnersPulseRing class="pointer-events-none absolute left-[-7px] top-[-4px] h-[32px] w-[32px]" />
            </Show>
            <span>{props.emoji}</span>
          </div>
        </Show>
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
  store: { anime: NonNullable<Awaited<ReturnType<typeof fetchDetails>>> }
  onRender?: () => Promise<void>
}

export const CardDetail: Component<Props> = (props) => {
  const settingsStore = useSettingsStore()
  const [isMakingFavorite, setMakingFavorite] = createSignal<boolean>(false)
  const [isFavorite, setFavorite] = createSignal<boolean>(false)
  const [softFavoriteAdditionCount, setSoftFavoriteAdditionCount] = createSignal(0)
  const details = createMemo(() => props.store.anime[props.card.title])
  const tags = createMemo(() => Object.values(settingsStore.data().tagColor).reduce((acc, entry) => {
    if (entry.name && entry.color) {
      acc[entry.name] = entry.color
    }
    return acc
  }, {} as Record<string, string>))
  const genreSettings = createMemo(() => Object.values(settingsStore.data().genreColor).reduce((acc, entry) => {
    if (entry.name && entry.color) {
      acc[entry.name] = entry.color
    }
    return acc
  }, {} as Record<string, string>))

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
      <Switch fallback={<SvgSpinners3DotsMove />}>
        <Match when={details() === null}>
          <div class="flex items-center gap-1">
            <StreamlineFreehandServerError404NotFound class="size-[16px]" />
            Not Found
          </div>
        </Match>
        <Match when={details()}>
          <div class={clsx(styles.row, 'justify-between')}>
            <Show when={details()?.favourites != null}>
              <Detail
                emoji={
                  isFavorite()
                    ? <LineMdHeartFilled class="text-red-500" />
                    : <MdiHeart class="text-red-500" />

                }
                class="text-white decoration-none hover:decoration-underline"
                loading={isMakingFavorite()}
                text={details()!.favourites! + softFavoriteAdditionCount()}
                title={isFavorite() ? 'Remove Favorite' : 'Add Favorite'}
                onClick={handleFavoriteClick}
              />
            </Show>
            <Show when={details()?.startDate != null && isTrending(details()!)}>
              <Detail
                emoji="⚡"
                title="Trending"
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
                  <div style={{ color: genreSettings()[genre!] }}>
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
                  <div style={{ color: tags()[name] }}>
                    {name}
                  </div>
                )}
              </For>
            </TagContainer>
          </Show>
        </Match>
      </Switch>
    </div>
  )
}
