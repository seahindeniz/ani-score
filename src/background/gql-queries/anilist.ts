import { graphql } from '~/gql'

export const singleAnimeQuery = graphql(/* GraphQL */ `
query SingleAnimeTemplate  {
  one_piece: Page(perPage: 1) {
    results: media(type: ANIME, id: 21) {
      id
      episodes
      favourites
      isFavourite
      popularity
      genres
      description
      status(version: 2)
      format
      season
      seasonYear
      genres
      title {
        userPreferred
        romaji
      }
      mediaListEntry {
        progress
      }
      nextAiringEpisode {
        episode
      }
      tags {
        name
        rank
      }
      startDate {
        day
        month
        year
      }
      coverImage {
        extraLarge
        large
      }
      relations {
        edges {
          id
          relationType(version: 2)
          node {
            siteUrl
            title {
              userPreferred
            }
            format
            type
            coverImage {
              large
            }
          }
        }
      }
      characterPreview: characters(perPage: 6, sort: [ROLE, RELEVANCE, ID]) {
        edges {
          role
          name
          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
            siteUrl
            name {
              userPreferred
            }
            language: languageV2
            image {
              large
            }
          }
          node {
            siteUrl
            name {
              userPreferred
            }
            image {
              large
            }
          }
        }
      }
    }
  }
}
`)

export const batchTemplate = graphql(/* GraphQL */ `
query BatchAnimeTemplate {
  withId: Page (perPage: 1) {
    results: media(type: ANIME, id: 20) {
      id
    }
  }
  withIdMal: Page (perPage: 1) {
    results: media(type: ANIME, idMal: 20) {
      id
    }
  }
  withSearch: Page (perPage: 1) {
    results: media(type: ANIME, search: "PLACEHOLDER") {
      id
    }
  }
}
`)

export const makeMediaFavoriteQuery = graphql(/* GraphQL */ `
mutation MakeMediaFavorite (
  $animeId: Int
  $mangaId: Int
  $characterId: Int
  $staffId: Int
  $studioId: Int
) {
  ToggleFavourite(
    animeId: $animeId
    mangaId: $mangaId
    characterId: $characterId
    staffId: $staffId
    studioId: $studioId
  ) {
    anime {
      pageInfo {
        total
      }
    }
    manga {
      pageInfo {
        total
      }
    }
    characters {
      pageInfo {
        total
      }
    }
    staff {
      pageInfo {
        total
      }
    }
    studios {
      pageInfo {
        total
      }
    }
  }
}
`)

export const genreCollectionQuery = graphql(/* GraphQL */ `
  query GenreCollection {
    GenreCollection
  }
`)
