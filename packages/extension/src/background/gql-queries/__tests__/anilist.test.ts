import { expect, test } from 'bun:test';

import type { DocumentNode, OperationDefinitionNode } from 'graphql';

import {
  batchTemplate,
  genreCollectionQuery,
  makeMediaFavoriteQuery,
  singleAnimeQuery,
} from '../anilist';

function operation(document: DocumentNode) {
  return document.definitions[0] as OperationDefinitionNode;
}

test('defines the AniList operations the extension sends', () => {
  expect(operation(singleAnimeQuery)).toMatchObject({
    operation: 'query',
    name: { value: 'SingleAnimeTemplate' },
  });
  expect(operation(genreCollectionQuery)).toMatchObject({
    operation: 'query',
    name: { value: 'GenreCollection' },
  });
  expect(operation(makeMediaFavoriteQuery)).toMatchObject({
    operation: 'mutation',
    name: { value: 'MakeMediaFavorite' },
  });
});

test('offers a batch template for each way to look an anime up', () => {
  const aliases = operation(batchTemplate).selectionSet.selections.map(
    (selection) => 'alias' in selection && selection.alias?.value,
  );

  expect(aliases).toEqual(['withId', 'withIdMal', 'withSearch']);
});
