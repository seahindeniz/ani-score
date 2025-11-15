import type { Component } from 'solid-js'
import type { AnimeDetails } from '~/background/logic/fetchDetails'
import { For, Show } from 'solid-js'
import { Popover } from '~/components/Popover'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { useRefStore } from '../../store/refStore'
import { Chip } from './Chip'

interface AnimeInfoCardProps {
  anime: AnimeDetails
}

export const AnimeInfoCard: Component<AnimeInfoCardProps> = (props) => {
  let popoverRef!: ComponentRef<typeof Popover>
  const refStore = useRefStore()

  const cleanDescription = (html: string) => {
    return html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<i>/gi, '')
      .replace(/<\/i>/gi, '')
      .replace(/\n/g, ' ')
      .trim()
  }

  const truncateText = (text: string, maxLength: number = 180) => {
    const cleaned = cleanDescription(text)
    if (cleaned.length <= maxLength)
      return cleaned
    return `${cleaned.slice(0, maxLength).trim()}...`
  }

  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  const formatRelationType = (type: string) => {
    return type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')
  }

  const handleChange = (isOpen: boolean) => {
    if (isOpen && popoverRef !== refStore.activeAnimeInfoPopoverRef) {
      refStore.activeAnimeInfoPopoverRef?.close()

      refStore.activeAnimeInfoPopoverRef = popoverRef
    }

    if (!isOpen && refStore.activeAnimeInfoPopoverRef === popoverRef) {
      refStore.activeAnimeInfoPopoverRef = null
    }
  }

  return (
    <Popover
      ref={popoverRef}
      portTo={refStore.portalRoot?.root}
      closeMode="click"
      closeDelay={200}
      onChange={handleChange}
      trigger={(
        <Chip
          tagName="a"
          emoji="📈"
          class="text-white decoration-none hover:decoration-underline"
          text={props.anime.popularity?.toLocaleString()}
          title="Popularity [Visit AniList]"
          onClick={event => event.stopPropagation()}
          attributes={{
            href: `https://anilist.co/anime/${props.anime.id}`,
            target: '_blank',
            rel: 'noopener noreferrer',
          }}
        />
      )}
    >
      <Card class="border-0 shadow-none">
        <CardContent class="flex p-0">
          <div class="w-[240px] flex flex-col">
            <div class="relative h-[340px] overflow-hidden rounded-t-lg">
              <Show when={props.anime.coverImage?.large}>
                <img
                  src={props.anime.coverImage!.large || ''}
                  alt={props.anime.title!.userPreferred || ''}
                  referrerPolicy="no-referrer"
                  class="h-full w-full object-cover"
                />
              </Show>
              <div class="absolute inset-0 from-black/80 via-black/40 to-transparent bg-gradient-to-t" />
            </div>
            <div class="absolute bottom-0 left-0 right-0 w-inherit p-4">
              <Show when={props.anime.title?.userPreferred}>
                <h3 class="mb-2 text-lg text-white font-semibold leading-tight">
                  {props.anime.title!.userPreferred}
                </h3>
              </Show>
              <div class="flex flex-wrap gap-2">
                <Badge variant="secondary" class="cursor-default text-xs">
                  {props.anime.format}
                </Badge>
                <Badge variant="outline" class="cursor-default border-white/50 text-xs text-white">
                  {formatStatus(props.anime.status || '')}
                </Badge>
                <Show when={props.anime.episodes}>
                  <Badge variant="outline" class="cursor-default border-white/50 text-xs text-white">
                    {props.anime.episodes}
                    {' '}
                    Episodes
                  </Badge>
                </Show>
                <Show when={props.anime.season && props.anime.seasonYear}>
                  <Badge variant="outline" class="cursor-default border-white/50 text-xs text-white">
                    {props.anime.season}
                    {' '}
                    {props.anime.seasonYear}
                  </Badge>
                </Show>
              </div>
            </div>
          </div>
          <div class="w-[360px] p-4 space-y-3">
            <div>
              <p class="text-sm text-muted-foreground leading-relaxed">
                {truncateText(props.anime.description || '')}
              </p>
            </div>
            <Show when={props.anime.genres && props.anime.genres.length > 0}>
              <div class="flex flex-wrap gap-1.5">
                <For each={props.anime.genres}>
                  {genre => (
                    <Badge variant="secondary" class="cursor-default text-xs">
                      {genre}
                    </Badge>
                  )}
                </For>
              </div>
            </Show>
            <Show when={
              props.anime.tags?.length
              || props.anime.relations?.edges?.length
              || props.anime.characterPreview?.edges?.length
            }
            >
              <Accordion multiple={false} collapsible class="w-full">
                <Show when={props.anime.tags?.length}>
                  <AccordionItem value="tags">
                    <AccordionTrigger class="py-2 text-sm">
                      Tags (
                      {props.anime.tags!.length}
                      )
                    </AccordionTrigger>
                    <AccordionContent>
                      <div class="max-h-[220px] overflow-y-auto pt-1 space-y-2">
                        <For each={props.anime.tags}>
                          {tag => (
                            <div class="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50">
                              <div class="min-w-0 flex items-center gap-2xl">
                                <p class="truncate text-sm font-medium">
                                  {tag?.name}
                                </p>
                                <Show when={tag?.rank != null}>
                                  <p class="truncate text-sm font-medium">
                                    <Badge variant="secondary" class="cursor-default text-xs">
                                      {tag!.rank}
                                    </Badge>
                                  </p>
                                </Show>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Show>
                <Show when={props.anime.relations?.edges?.length}>
                  <AccordionItem value="relations">
                    <AccordionTrigger class="py-2 text-sm">
                      Relations (
                      {props.anime.relations!.edges!.length}
                      )
                    </AccordionTrigger>
                    <AccordionContent>
                      <div class="max-h-[220px] overflow-y-auto pt-1 space-y-2">
                        <For each={props.anime.relations!.edges}>
                          {relation => relation?.node && (
                            <a
                              href={relation.node.siteUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                            >
                              <Show when={relation.node.coverImage?.large}>
                                <img
                                  src={relation.node.coverImage!.large || ''}
                                  alt={relation.node.title?.userPreferred || ''}
                                  class="h-16 w-12 flex-shrink-0 rounded object-cover"
                                />
                              </Show>
                              <div class="min-w-0 flex-1">
                                <Show when={relation.node.title?.userPreferred}>
                                  <p class="truncate text-sm font-medium">
                                    {relation.node.title!.userPreferred}
                                  </p>
                                </Show>
                                <div class="mt-1 flex flex-wrap gap-1.5">
                                  <Badge variant="outline" class="cursor-default text-xs">
                                    {formatRelationType(relation.relationType || '')}
                                  </Badge>
                                  <Badge variant="secondary" class="cursor-default text-xs">
                                    {relation.node.type}
                                  </Badge>
                                  <Show when={relation.node.type !== relation.node.format}>
                                    <Badge variant="secondary" class="cursor-default text-xs">
                                      {relation.node.format}
                                    </Badge>
                                  </Show>
                                </div>
                              </div>
                            </a>
                          )}
                        </For>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Show>
                <Show when={props.anime.characterPreview?.edges?.length}>
                  <AccordionItem value="characters">
                    <AccordionTrigger class="py-2 text-sm">
                      Characters (
                      {props.anime.characterPreview!.edges?.length}
                      )
                    </AccordionTrigger>
                    <AccordionContent>
                      <div class="max-h-[220px] overflow-y-auto pt-1 space-y-2">
                        <For each={props.anime.characterPreview!.edges}>
                          {character => character?.node && (
                            <div class="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50">
                              <Show when={character.node.image?.large}>
                                <a
                                  href={character.node.siteUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={character.node.image!.large || ''}
                                    alt={character.node.name?.userPreferred || ''}
                                    class="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                                  />
                                </a>
                              </Show>
                              <div class="min-w-0 flex-1">
                                <Show when={character.node.name?.userPreferred}>
                                  <p class="truncate text-sm font-medium">
                                    {character.node.name!.userPreferred}
                                  </p>
                                </Show>
                                <div class="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span>{character.role}</span>
                                  <Show when={character.voiceActors?.[0]}>
                                    <span>•</span>
                                    <span class="truncate">
                                      {character.voiceActors![0]!.name?.userPreferred}
                                    </span>
                                  </Show>
                                </div>
                              </div>
                              <Show when={character.voiceActors?.[0]?.image?.large}>
                                <a
                                  href={character.voiceActors![0]!.siteUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={character.voiceActors![0]!.image!.large || ''}
                                    alt={character.voiceActors![0]!.name?.userPreferred || ''}
                                    class="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                                  />
                                </a>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Show>
              </Accordion>
            </Show>
          </div>
        </CardContent>
      </Card>
    </Popover>
  )
}
