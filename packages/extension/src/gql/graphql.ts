/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** The role the character plays in the media */
export type CharacterRole =
  /** A background character in the media */
  | 'BACKGROUND'
  /** A primary character role in the media */
  | 'MAIN'
  /** A supporting character role in the media */
  | 'SUPPORTING';

/** The format the media was released in */
export type MediaFormat =
  /** Professionally published manga with more than one chapter */
  | 'MANGA'
  /** Anime movies with a theatrical release */
  | 'MOVIE'
  /** Short anime released as a music video */
  | 'MUSIC'
  /** Written books released as a series of light novels */
  | 'NOVEL'
  /** (Original Net Animation) Anime that have been originally released online or are only available through streaming services. */
  | 'ONA'
  /** Manga with just one chapter */
  | 'ONE_SHOT'
  /** (Original Video Animation) Anime that have been released directly on DVD/Blu-ray without originally going through a theatrical release or television broadcast */
  | 'OVA'
  /** Special episodes that have been included in DVD/Blu-ray releases, picture dramas, pilots, etc */
  | 'SPECIAL'
  /** Anime broadcast on television */
  | 'TV'
  /** Anime which are under 15 minutes in length and broadcast on television */
  | 'TV_SHORT';

/** Type of relation media has to its parent. */
export type MediaRelation =
  /** An adaption of this media into a different format */
  | 'ADAPTATION'
  /** An alternative version of the same media */
  | 'ALTERNATIVE'
  /** Shares at least 1 character */
  | 'CHARACTER'
  /** Version 2 only. */
  | 'COMPILATION'
  /** Version 2 only. */
  | 'CONTAINS'
  /** Other */
  | 'OTHER'
  /** The media a side story is from */
  | 'PARENT'
  /** Released before the relation */
  | 'PREQUEL'
  /** Version 3 only. The media is set in the same universe as another media */
  | 'SAME_UNIVERSE'
  /** Released after the relation */
  | 'SEQUEL'
  /** A side story of the parent media */
  | 'SIDE_STORY'
  /** Version 2 only. The source material the media was adapted from */
  | 'SOURCE'
  /** An alternative version of the media with a different primary focus */
  | 'SPIN_OFF'
  /** A shortened and summarized version */
  | 'SUMMARY';

export type MediaSeason =
  /** Predominantly started airing between October and November */
  | 'FALL'
  /** Predominantly started airing between April and June */
  | 'SPRING'
  /** Predominantly started airing between July and September */
  | 'SUMMER'
  /** Predominantly started airing between January and March */
  | 'WINTER';

/** The current releasing status of the media */
export type MediaStatus =
  /** Ended before the work could be finished */
  | 'CANCELLED'
  /** Has completed and is no longer being released */
  | 'FINISHED'
  /** Version 2 only. Is currently paused from releasing and will resume at a later date */
  | 'HIATUS'
  /** To be released at a later date */
  | 'NOT_YET_RELEASED'
  /** Currently releasing */
  | 'RELEASING';

/** Media type enum, anime or manga. */
export type MediaType =
  /** Japanese Anime */
  | 'ANIME'
  /** Asian comic */
  | 'MANGA';

export type SingleAnimeTemplateQueryVariables = Exact<{ [key: string]: never; }>;


export type SingleAnimeTemplateQuery = { one_piece: { results: Array<{ id: number, episodes: number | null, favourites: number | null, isFavourite: boolean, popularity: number | null, genres: Array<string | null> | null, description: string | null, status: MediaStatus | null, format: MediaFormat | null, season: MediaSeason | null, seasonYear: number | null, title: { userPreferred: string | null, romaji: string | null } | null, mediaListEntry: { progress: number | null } | null, nextAiringEpisode: { episode: number } | null, tags: Array<{ name: string, rank: number | null } | null> | null, startDate: { day: number | null, month: number | null, year: number | null } | null, coverImage: { extraLarge: string | null, large: string | null } | null, relations: { edges: Array<{ id: number | null, relationType: MediaRelation | null, node: { siteUrl: string | null, format: MediaFormat | null, type: MediaType | null, title: { userPreferred: string | null } | null, coverImage: { large: string | null } | null } | null } | null> | null } | null, characterPreview: { edges: Array<{ role: CharacterRole | null, name: string | null, voiceActors: Array<{ siteUrl: string | null, language: string | null, name: { userPreferred: string | null } | null, image: { large: string | null } | null } | null> | null, node: { siteUrl: string | null, name: { userPreferred: string | null } | null, image: { large: string | null } | null } | null } | null> | null } | null } | null> | null } | null };

export type BatchAnimeTemplateQueryVariables = Exact<{ [key: string]: never; }>;


export type BatchAnimeTemplateQuery = { withId: { results: Array<{ id: number } | null> | null } | null, withIdMal: { results: Array<{ id: number } | null> | null } | null, withSearch: { results: Array<{ id: number } | null> | null } | null };

export type MakeMediaFavoriteMutationVariables = Exact<{
  animeId?: number | null | undefined;
  mangaId?: number | null | undefined;
  characterId?: number | null | undefined;
  staffId?: number | null | undefined;
  studioId?: number | null | undefined;
}>;


export type MakeMediaFavoriteMutation = { ToggleFavourite: { anime: { pageInfo: { total: number | null } | null } | null, manga: { pageInfo: { total: number | null } | null } | null, characters: { pageInfo: { total: number | null } | null } | null, staff: { pageInfo: { total: number | null } | null } | null, studios: { pageInfo: { total: number | null } | null } | null } | null };

export type GenreCollectionQueryVariables = Exact<{ [key: string]: never; }>;


export type GenreCollectionQuery = { GenreCollection: Array<string | null> | null };


export const SingleAnimeTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SingleAnimeTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"one_piece"},"name":{"kind":"Name","value":"Page"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perPage"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"results"},"name":{"kind":"Name","value":"media"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"ANIME"}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"IntValue","value":"21"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}},{"kind":"Field","name":{"kind":"Name","value":"favourites"}},{"kind":"Field","name":{"kind":"Name","value":"isFavourite"}},{"kind":"Field","name":{"kind":"Name","value":"popularity"}},{"kind":"Field","name":{"kind":"Name","value":"genres"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"status"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"version"},"value":{"kind":"IntValue","value":"2"}}]},{"kind":"Field","name":{"kind":"Name","value":"format"}},{"kind":"Field","name":{"kind":"Name","value":"season"}},{"kind":"Field","name":{"kind":"Name","value":"seasonYear"}},{"kind":"Field","name":{"kind":"Name","value":"genres"}},{"kind":"Field","name":{"kind":"Name","value":"title"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPreferred"}},{"kind":"Field","name":{"kind":"Name","value":"romaji"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mediaListEntry"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"progress"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextAiringEpisode"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"episode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}},{"kind":"Field","name":{"kind":"Name","value":"startDate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"day"}},{"kind":"Field","name":{"kind":"Name","value":"month"}},{"kind":"Field","name":{"kind":"Name","value":"year"}}]}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extraLarge"}},{"kind":"Field","name":{"kind":"Name","value":"large"}}]}},{"kind":"Field","name":{"kind":"Name","value":"relations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"relationType"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"version"},"value":{"kind":"IntValue","value":"2"}}]},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"siteUrl"}},{"kind":"Field","name":{"kind":"Name","value":"title"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPreferred"}}]}},{"kind":"Field","name":{"kind":"Name","value":"format"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"coverImage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"large"}}]}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"characterPreview"},"name":{"kind":"Name","value":"characters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perPage"},"value":{"kind":"IntValue","value":"6"}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"ROLE"},{"kind":"EnumValue","value":"RELEVANCE"},{"kind":"EnumValue","value":"ID"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"voiceActors"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"language"},"value":{"kind":"EnumValue","value":"JAPANESE"}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"ListValue","values":[{"kind":"EnumValue","value":"RELEVANCE"},{"kind":"EnumValue","value":"ID"}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"siteUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPreferred"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"language"},"name":{"kind":"Name","value":"languageV2"}},{"kind":"Field","name":{"kind":"Name","value":"image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"large"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"siteUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPreferred"}}]}},{"kind":"Field","name":{"kind":"Name","value":"image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"large"}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<SingleAnimeTemplateQuery, SingleAnimeTemplateQueryVariables>;
export const BatchAnimeTemplateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BatchAnimeTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"withId"},"name":{"kind":"Name","value":"Page"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perPage"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"results"},"name":{"kind":"Name","value":"media"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"ANIME"}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"IntValue","value":"20"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"withIdMal"},"name":{"kind":"Name","value":"Page"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perPage"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"results"},"name":{"kind":"Name","value":"media"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"ANIME"}},{"kind":"Argument","name":{"kind":"Name","value":"idMal"},"value":{"kind":"IntValue","value":"20"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"withSearch"},"name":{"kind":"Name","value":"Page"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"perPage"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"results"},"name":{"kind":"Name","value":"media"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"ANIME"}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"StringValue","value":"PLACEHOLDER","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<BatchAnimeTemplateQuery, BatchAnimeTemplateQueryVariables>;
export const MakeMediaFavoriteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MakeMediaFavorite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"animeId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mangaId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"characterId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"staffId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"studioId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ToggleFavourite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"animeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"animeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"mangaId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mangaId"}}},{"kind":"Argument","name":{"kind":"Name","value":"characterId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"characterId"}}},{"kind":"Argument","name":{"kind":"Name","value":"staffId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"staffId"}}},{"kind":"Argument","name":{"kind":"Name","value":"studioId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"studioId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"manga"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"characters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"staff"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"studios"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}}]}}]}}]} as unknown as DocumentNode<MakeMediaFavoriteMutation, MakeMediaFavoriteMutationVariables>;
export const GenreCollectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GenreCollection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"GenreCollection"}}]}}]} as unknown as DocumentNode<GenreCollectionQuery, GenreCollectionQueryVariables>;