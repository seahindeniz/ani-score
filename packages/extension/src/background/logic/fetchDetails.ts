import { listSiteHosts } from '@ani-score/anime-index';
import type { TypedDocumentNode } from '@urql/core';
import type { FieldNode } from 'graphql';
import { Kind } from 'graphql';

import type { EpisodeCard } from '~/contentScripts/sites/types';
import type {
  BatchAnimeTemplateQuery,
  BatchAnimeTemplateQueryVariables,
} from '~/gql/graphql';
import { useTokenStore } from '~/logic';
import { logger } from '~/utils/logger';
import { wait } from '~/utils/wait';

import { anilistClient, isSignedOut } from '../client/anilist';
import { batchTemplate, singleAnimeQuery } from '../gql-queries/anilist';
import { cacheDetails, readCachedDetails } from './detailsCache';
import { searchAnimeByTitle } from './loadDatabase';
import { openSignIn } from './openSignIn';

interface Props {
  cards: Pick<EpisodeCard, 'title' | 'episodeNumber'>[];
  /**
   * Asks AniList again for details kept longer than this many milliseconds: 0 after the user changed the anime there,
   * a little longer when they open its details.
   */
  maxAge?: number;
}

const maxAnimePerQuery = 5;
const maxAliasCharacters = 70;

const _inheritType = anilistClient.query(singleAnimeQuery, {});

export type AnimeDetails = NonNullable<
  NonNullable<
    NonNullable<
      NonNullable<Awaited<typeof _inheritType>['data']>['one_piece']
    >['results']
  >[0]
>;

function createAlias(title: string, index: number): string {
  const cleanTitle = title
    .slice(0, maxAliasCharacters)
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

  return `a_${index + 1}_${cleanTitle}`;
}

function generateBatchQuery(
  animeList: Awaited<ReturnType<typeof findAnimeListInDatabase>>,
) {
  let currentChunk: FieldNode[] = [];
  let chunkIndex = 0;

  return animeList.reduce(
    (acc, { title, anilist, mal }, index) => {
      const alias = createAlias(title, index);
      const source = anilist ? 'withId' : mal ? `withIdMal` : `withSearch`;
      const [batchQueryKeyDefinition] = batchTemplate.definitions;

      if (batchQueryKeyDefinition.kind === Kind.OPERATION_DEFINITION) {
        const template = batchQueryKeyDefinition.selectionSet.selections.find(
          (selection) => {
            return (
              selection.kind === Kind.FIELD && selection.alias?.value === source
            );
          },
        ) as FieldNode | undefined;

        const query = structuredClone(template);

        if (query?.selectionSet) {
          Object.assign(query.alias!, { value: alias });

          const [resultsField] = query.selectionSet.selections;

          if (resultsField.kind === Kind.FIELD) {
            if (resultsField.arguments) {
              const [, idOrSearchArgument] = resultsField.arguments;

              if (
                idOrSearchArgument.value.kind === Kind.INT
                || idOrSearchArgument.value.kind === Kind.STRING
              ) {
                Object.assign(idOrSearchArgument.value, {
                  // The query printer escapes string values, so the title goes in as is
                  value:
                    source === 'withId'
                      ? anilist!
                      : source === 'withIdMal'
                        ? mal!
                        : title,
                });
              }
            }

            if (resultsField.selectionSet) {
              const [singleQueryKeyDefinition] = singleAnimeQuery.definitions;

              if (singleQueryKeyDefinition.kind === Kind.OPERATION_DEFINITION) {
                const [singleAnimeAliasKeyField] =
                  singleQueryKeyDefinition.selectionSet.selections;

                if (
                  singleAnimeAliasKeyField.kind === Kind.FIELD
                  && singleAnimeAliasKeyField.selectionSet
                ) {
                  const [singleResultsField] =
                    singleAnimeAliasKeyField.selectionSet.selections;

                  if (singleResultsField.kind === Kind.FIELD)
                    Object.assign(resultsField.selectionSet, {
                      selections: singleResultsField.selectionSet?.selections,
                    });
                }
              }
            }
          }

          currentChunk.push(query);

          if (
            currentChunk.length === maxAnimePerQuery
            || index === animeList.length - 1
          ) {
            const compiledQuery = structuredClone(batchTemplate);
            const [batchQueryKeyDefinition] = compiledQuery.definitions;

            if (batchQueryKeyDefinition.kind === Kind.OPERATION_DEFINITION) {
              if (batchQueryKeyDefinition.name) {
                Object.assign(batchQueryKeyDefinition.name!, {
                  value: `BatchAnimeSearch${chunkIndex}`,
                });
              }

              batchQueryKeyDefinition.selectionSet.selections = currentChunk;
            }

            acc.push(compiledQuery);

            currentChunk = [];
            chunkIndex++;
          }
        }
      }

      return acc;
    },
    [] as TypedDocumentNode<
      BatchAnimeTemplateQuery,
      BatchAnimeTemplateQueryVariables
    >[],
  );
}

function removeAllBeforeSlash(url: string): string {
  return url.replace(/.*\//, '');
}

async function findSourceInDatabase(title: string) {
  const anime = await searchAnimeByTitle(title);

  if (!anime) {
    return undefined;
  }

  // `toSorted`: the sources belong to the index and the search cache
  return anime.sources
    ?.toSorted(
      (a, b) =>
        Number.parseInt(removeAllBeforeSlash(a))
        - Number.parseInt(removeAllBeforeSlash(b)),
    )
    .reduce(
      (map, item) => {
        if (item.includes(listSiteHosts.anilist)) {
          map.anilist = removeAllBeforeSlash(item);
        }

        if (item.includes(listSiteHosts.mal)) {
          map.mal = removeAllBeforeSlash(item);
        }

        return map;
      },
      {} as { anilist?: string; mal?: string },
    );
}

function findAnimeListInDatabase(titles: string[]) {
  return Promise.all(
    titles.map(async (title) => {
      const sources = await findSourceInDatabase(title);

      return { title, ...sources };
    }),
  );
}

type FetchResult = Record<
  string,
  {
    pageInfo: { hasNextPage: boolean };
    results: AnimeDetails[];
  } | null
>;

export async function fetchDetails(props: Props) {
  const uniqueTitles = [...new Set(props.cards.map((card) => card.title))];

  if (uniqueTitles.length === 0) {
    return undefined;
  }

  const { found, missing } = readCachedDetails(uniqueTitles, {
    maxAge: props.maxAge,
  });

  if (missing.length === 0) return found;

  const tokenStore = useTokenStore();

  await tokenStore.dataReady;

  if (!tokenStore.data().anilist) {
    await openSignIn();

    return undefined;
  }

  logger.log('Fetching details for titles:', missing);

  try {
    const dbResult = await findAnimeListInDatabase(missing);
    const queries = generateBatchQuery(dbResult);
    const queryPromises = [];

    for (const query of queries) {
      queryPromises.push(
        anilistClient
          .query<FetchResult>(
            query,
            {},
            {
              requestPolicy: 'network-only',
            },
          )
          .toPromise()
          // urql reports failures through `error`; a rejection here is unexpected, and is handled right away so it
          // isn't left unhandled while the next batch waits
          .catch((error: unknown) => ({
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error)),
          })),
      );

      await wait(150);
    }

    const results = await Promise.all(queryPromises);

    // AniList rejected the token, which the client then forgot
    if (results.some(({ error }) => isSignedOut(error))) {
      await openSignIn();

      return undefined;
    }

    for (const { error } of results) {
      if (error) logger.error('GraphQL query error:', error);
    }

    // Other errors only lose their own batch; the titles in it come back as not found
    const mergedData = results.reduce(
      (map, result) => {
        if (result.data) {
          Object.assign(map, result.data);
        }

        return map;
      },
      {} as Record<
        string,
        {
          pageInfo: { hasNextPage: boolean };
          results: AnimeDetails[];
        } | null
      >,
    );

    const fetched: Record<string, AnimeDetails | null> = {};
    const answered: Record<string, AnimeDetails | null> = {};

    missing.forEach((title, index) => {
      const alias = createAlias(title, index);

      fetched[title] = mergedData[alias]?.results[0] || null;

      // A failed batch is asked for again next time
      if (alias in mergedData) answered[title] = fetched[title];
    });

    cacheDetails(answered);

    return { ...found, ...fetched };
  } catch (error) {
    logger.error('Error fetching anime details:', error);

    return undefined;
  }
}
