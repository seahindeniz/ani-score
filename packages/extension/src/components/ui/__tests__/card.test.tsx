import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@solidjs/testing-library';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../card';

afterEach(cleanup);

describe('card', () => {
  it('renders every part with its classes', () => {
    render(() => (
      <Card class="card" data-testid="card">
        <CardHeader class="header" data-testid="header">
          <CardTitle class="title">Title</CardTitle>
          <CardDescription class="description">Description</CardDescription>
        </CardHeader>
        <CardContent class="content">Content</CardContent>
        <CardFooter class="footer">Footer</CardFooter>
      </Card>
    ));

    expect(screen.getByTestId('card').className).toContain('rounded-lg border');
    expect(screen.getByTestId('card').className).toContain('card');
    expect(screen.getByTestId('header').className).toContain('header');
    expect(screen.getByRole('heading', { name: 'Title' }).className).toContain(
      'title',
    );
    expect(screen.getByText('Description').tagName).toBe('P');
    expect(screen.getByText('Description').className).toContain(
      'text-muted-foreground',
    );
    expect(screen.getByText('Content').className).toContain('content');
    expect(screen.getByText('Footer').className).toContain('footer');
  });
});
