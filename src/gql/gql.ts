/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\nquery SingleAnimeTemplate  {\n  one_piece: Page(perPage: 1) {\n    results: media(type: ANIME, id: 21) {\n      id\n      episodes\n      favourites\n      isFavourite\n      popularity\n      genres\n      description\n      status(version: 2)\n      format\n      season\n      seasonYear\n      genres\n      title {\n        userPreferred\n        romaji\n      }\n      mediaListEntry {\n        progress\n      }\n      nextAiringEpisode {\n        episode\n      }\n      tags {\n        name\n        rank\n      }\n      startDate {\n        day\n        month\n        year\n      }\n      coverImage {\n        extraLarge\n        large\n      }\n      relations {\n        edges {\n          id\n          relationType(version: 2)\n          node {\n            siteUrl\n            title {\n              userPreferred\n            }\n            format\n            type\n            coverImage {\n              large\n            }\n          }\n        }\n      }\n      characterPreview: characters(perPage: 6, sort: [ROLE, RELEVANCE, ID]) {\n        edges {\n          role\n          name\n          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {\n            siteUrl\n            name {\n              userPreferred\n            }\n            language: languageV2\n            image {\n              large\n            }\n          }\n          node {\n            siteUrl\n            name {\n              userPreferred\n            }\n            image {\n              large\n            }\n          }\n        }\n      }\n    }\n  }\n}\n": typeof types.SingleAnimeTemplateDocument,
    "\nquery BatchAnimeTemplate {\n  withId: Page (perPage: 1) {\n    results: media(type: ANIME, id: 20) {\n      id\n    }\n  }\n  withIdMal: Page (perPage: 1) {\n    results: media(type: ANIME, idMal: 20) {\n      id\n    }\n  }\n  withSearch: Page (perPage: 1) {\n    results: media(type: ANIME, search: \"PLACEHOLDER\") {\n      id\n    }\n  }\n}\n": typeof types.BatchAnimeTemplateDocument,
    "\n  query GenreCollection {\n    GenreCollection\n  }\n": typeof types.GenreCollectionDocument,
    "\n  mutation MakeAnimeFavorite($animeId: Int!) {\n    ToggleFavourite(animeId: $animeId) {\n      anime {\n        pageInfo {\n          total\n        }\n      }\n    }\n  }\n": typeof types.MakeAnimeFavoriteDocument,
};
const documents: Documents = {
    "\nquery SingleAnimeTemplate  {\n  one_piece: Page(perPage: 1) {\n    results: media(type: ANIME, id: 21) {\n      id\n      episodes\n      favourites\n      isFavourite\n      popularity\n      genres\n      description\n      status(version: 2)\n      format\n      season\n      seasonYear\n      genres\n      title {\n        userPreferred\n        romaji\n      }\n      mediaListEntry {\n        progress\n      }\n      nextAiringEpisode {\n        episode\n      }\n      tags {\n        name\n        rank\n      }\n      startDate {\n        day\n        month\n        year\n      }\n      coverImage {\n        extraLarge\n        large\n      }\n      relations {\n        edges {\n          id\n          relationType(version: 2)\n          node {\n            siteUrl\n            title {\n              userPreferred\n            }\n            format\n            type\n            coverImage {\n              large\n            }\n          }\n        }\n      }\n      characterPreview: characters(perPage: 6, sort: [ROLE, RELEVANCE, ID]) {\n        edges {\n          role\n          name\n          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {\n            siteUrl\n            name {\n              userPreferred\n            }\n            language: languageV2\n            image {\n              large\n            }\n          }\n          node {\n            siteUrl\n            name {\n              userPreferred\n            }\n            image {\n              large\n            }\n          }\n        }\n      }\n    }\n  }\n}\n": types.SingleAnimeTemplateDocument,
    "\nquery BatchAnimeTemplate {\n  withId: Page (perPage: 1) {\n    results: media(type: ANIME, id: 20) {\n      id\n    }\n  }\n  withIdMal: Page (perPage: 1) {\n    results: media(type: ANIME, idMal: 20) {\n      id\n    }\n  }\n  withSearch: Page (perPage: 1) {\n    results: media(type: ANIME, search: \"PLACEHOLDER\") {\n      id\n    }\n  }\n}\n": types.BatchAnimeTemplateDocument,
    "\n  query GenreCollection {\n    GenreCollection\n  }\n": types.GenreCollectionDocument,
    "\n  mutation MakeAnimeFavorite($animeId: Int!) {\n    ToggleFavourite(animeId: $animeId) {\n      anime {\n        pageInfo {\n          total\n        }\n      }\n    }\n  }\n": types.MakeAnimeFavoriteDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\nquery SingleAnimeTemplate  {\n  one_piece: Page(perPage: 1) {\n    results: media(type: ANIME, id: 21) {\n      id\n      episodes\n      favourites\n      isFavourite\n      popularity\n      genres\n      description\n      status(version: 2)\n      format\n      season\n      seasonYear\n      genres\n      title {\n        userPreferred\n        romaji\n      }\n      mediaListEntry {\n        progress\n      }\n      nextAiringEpisode {\n        episode\n      }\n      tags {\n        name\n        rank\n      }\n      startDate {\n        day\n        month\n        year\n      }\n      coverImage {\n        extraLarge\n        large\n      }\n      relations {\n        edges {\n          id\n          relationType(version: 2)\n          node {\n            siteUrl\n            title {\n              userPreferred\n            }\n            format\n            type\n            coverImage {\n              large\n            }\n          }\n        }\n      }\n      characterPreview: characters(perPage: 6, sort: [ROLE, RELEVANCE, ID]) {\n        edges {\n          role\n          name\n          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {\n            siteUrl\n            name {\n              userPreferred\n            }\n            language: languageV2\n            image {\n              large\n            }\n          }\n          node {\n            siteUrl\n            name {\n              userPreferred\n            }\n            image {\n              large\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"): (typeof documents)["\nquery SingleAnimeTemplate  {\n  one_piece: Page(perPage: 1) {\n    results: media(type: ANIME, id: 21) {\n      id\n      episodes\n      favourites\n      isFavourite\n      popularity\n      genres\n      description\n      status(version: 2)\n      format\n      season\n      seasonYear\n      genres\n      title {\n        userPreferred\n        romaji\n      }\n      mediaListEntry {\n        progress\n      }\n      nextAiringEpisode {\n        episode\n      }\n      tags {\n        name\n        rank\n      }\n      startDate {\n        day\n        month\n        year\n      }\n      coverImage {\n        extraLarge\n        large\n      }\n      relations {\n        edges {\n          id\n          relationType(version: 2)\n          node {\n            siteUrl\n            title {\n              userPreferred\n            }\n            format\n            type\n            coverImage {\n              large\n            }\n          }\n        }\n      }\n      characterPreview: characters(perPage: 6, sort: [ROLE, RELEVANCE, ID]) {\n        edges {\n          role\n          name\n          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {\n            siteUrl\n            name {\n              userPreferred\n            }\n            language: languageV2\n            image {\n              large\n            }\n          }\n          node {\n            siteUrl\n            name {\n              userPreferred\n            }\n            image {\n              large\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\nquery BatchAnimeTemplate {\n  withId: Page (perPage: 1) {\n    results: media(type: ANIME, id: 20) {\n      id\n    }\n  }\n  withIdMal: Page (perPage: 1) {\n    results: media(type: ANIME, idMal: 20) {\n      id\n    }\n  }\n  withSearch: Page (perPage: 1) {\n    results: media(type: ANIME, search: \"PLACEHOLDER\") {\n      id\n    }\n  }\n}\n"): (typeof documents)["\nquery BatchAnimeTemplate {\n  withId: Page (perPage: 1) {\n    results: media(type: ANIME, id: 20) {\n      id\n    }\n  }\n  withIdMal: Page (perPage: 1) {\n    results: media(type: ANIME, idMal: 20) {\n      id\n    }\n  }\n  withSearch: Page (perPage: 1) {\n    results: media(type: ANIME, search: \"PLACEHOLDER\") {\n      id\n    }\n  }\n}\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GenreCollection {\n    GenreCollection\n  }\n"): (typeof documents)["\n  query GenreCollection {\n    GenreCollection\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MakeAnimeFavorite($animeId: Int!) {\n    ToggleFavourite(animeId: $animeId) {\n      anime {\n        pageInfo {\n          total\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation MakeAnimeFavorite($animeId: Int!) {\n    ToggleFavourite(animeId: $animeId) {\n      anime {\n        pageInfo {\n          total\n        }\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;