import type { Component, FlowComponent, ParentComponent } from 'solid-js'
import type { EpisodeCard } from '../../../site/base'
import type { fetchDetails } from '~/background/logic/fetchDetails'
import clsx from 'clsx'
import { createEffect, createMemo, createSignal, For, Match, on, onMount, Show, Switch } from 'solid-js'
import AntDesignTagsFilled from '~icons/ant-design/tags-filled'
import DeviconPlainPlaywright from '~icons/devicon-plain/playwright'
import MdiHeart from '~icons/mdi/heart'
import MdiHeartMinus from '~icons/mdi/heart-minus'
import MdiHeartPlusOutline from '~icons/mdi/heart-plus-outline'
import StreamlineFreehandServerError404NotFound from '~icons/streamline-freehand/server-error-404-not-found'
import SvgSpinners3DotsMove from '~icons/svg-spinners/3-dots-move'
import { useSettingsStore } from '~/logic'
import { isTrending } from '~/utils/isTrending'
import { AnimeInfoCard } from './AnimeInfo'
import styles from './CardDetail.module.scss'
import { Chip } from './Chip'
import '~/styles'

const SubDetail: FlowComponent<{ title: string }> = props => (
  <div
    title={props.title}
    class={clsx('align-self text-sm', styles.subDetail)}
    style={{ 'align-self': 'start', 'line-height': '1.5em', 'font-size': '0.8em' }}
  >
    {props.children}
  </div>
)

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
  index: number
  onRender?: () => Promise<void>
}

export const CardDetail: Component<Props> = (props) => {
  let containerRef!: HTMLDivElement
  const settingsStore = useSettingsStore()
  const [isMakingFavorite, setMakingFavorite] = createSignal<boolean>(false)
  const [isFavorite, setFavorite] = createSignal<boolean>(false)
  const [softFavoriteAdditionCount, setSoftFavoriteAdditionCount] = createSignal(0)
  const details = createMemo(() => props.store.anime[props.card.title]!)
  const tags = createMemo(() => Object.values(settingsStore.data().tagColor).reduce((acc, entry) => {
    if (entry.name && entry.color) {
      acc[entry.name] = entry.color
    }
    return acc
  }, {} as Record<string, string>))
  const [heartHovered, setHeartHovered] = createSignal(false)
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
  })

  createEffect(on(details, (anime) => {
    if (!anime)
      return

    setFavorite(Boolean(anime?.isFavourite))
  }))

  return (
    <div
      ref={containerRef}
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
          <div
            class={clsx(styles.row, 'justify-between')}
            onMouseEnter={() => setHeartHovered(true)}
            onMouseLeave={() => setHeartHovered(false)}
          >
            <Show when={details()?.favourites != null}>
              <Chip
                emoji={
                  isFavorite()
                    ? (
                        heartHovered()
                          ? <MdiHeartMinus class="text-red-500" />
                          : <MdiHeart class="text-red-500" />
                      )
                    : <MdiHeartPlusOutline class="text-red-500" />
                }
                class="text-white decoration-none hover:decoration-underline"
                loading={isMakingFavorite()}
                text={details()!.favourites! + softFavoriteAdditionCount()}
                title={isFavorite() ? 'Remove Favorite' : 'Add Favorite'}
                onClick={handleFavoriteClick}
              />
            </Show>
            <Show when={details()?.startDate != null && isTrending(details()!)}>
              <Chip
                emoji="⚡"
                title="Trending"
              />
            </Show>
            <Show when={details()?.mediaListEntry}>
              <Chip
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
              </Chip>
            </Show>
            <Show when={details()?.popularity}>
              <AnimeInfoCard anime={details()!} />
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
              <For each={details()!.tags!.filter(item => item != null).slice(0, 5)}>
                {({ name }) => (
                  <div style={{ color: tags()[name.toLowerCase()] }}>
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
