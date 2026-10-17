import { afterEach, describe, expect, it } from 'bun:test'
import { toaster } from '@kobalte/core/toast'
import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { showToast, showToastPromise, Toaster } from '../toast'

afterEach(() => {
  toaster.clear()
  cleanup()
})

describe('toast', () => {
  it('shows a toast with its title and description, and closes it', async () => {
    render(() => <Toaster class="list" />)

    showToast({ title: 'Saved', description: 'Settings stored', variant: 'success' })

    const toast = (await screen.findByText('Saved')).closest('li')!

    expect(toast.className).toContain('bg-success')
    expect(screen.getByText('Settings stored').className).toContain('opacity-90')
    expect(screen.getByRole('list').className).toContain('list')

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(toast.hasAttribute('data-closed')).toBe(true))
    expect(toast.hasAttribute('data-opened')).toBe(false)

    // Kobalte removes a closed toast once its exit animation ends
    fireEvent.animationEnd(toast)

    await waitFor(() => expect(screen.queryByText('Saved')).toBeNull())
  })

  it('leaves out the title and description when not given', async () => {
    render(() => <Toaster />)

    showToast({})

    const toast = await waitFor(() => screen.getByRole('status'))

    expect(toast.className).toContain('bg-background')
    expect(toast.textContent).toBe('')
  })

  it('follows a promise from loading to success', async () => {
    render(() => <Toaster />)

    let resolve!: (value: string) => void

    showToastPromise(new Promise<string>(r => resolve = r), {
      loading: 'Loading',
      success: data => `Loaded ${data}`,
    })

    expect((await screen.findByText('Loading')).closest('li')!.className).toContain('bg-background')

    resolve('Frieren')

    expect((await screen.findByText('Loaded Frieren')).closest('li')!.className).toContain('bg-success')
  })

  it('shows the error when the promise rejects', async () => {
    render(() => <Toaster />)

    showToastPromise(() => Promise.reject(new Error('offline')), {
      error: (error: Error) => `Failed: ${error.message}`,
    })

    expect((await screen.findByText('Failed: offline')).closest('li')!.className).toContain('bg-error')
  })
})
