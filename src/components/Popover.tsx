import type { JSX, ParentComponent } from 'solid-js'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import {
  createGlobalListeners,
} from '@kobalte/utils'
import { debounce } from '@solid-primitives/scheduled'
import clsx from 'clsx'
import { createEffect, createMemo, createSignal, mergeProps, on, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createExpose } from '~/primitives/createExpose'

interface PopoverRef {
  close: () => void
}

interface Props {
  trigger: JSX.Element
  portTo?: HTMLElement
  openDelay?: number
  closeDelay?: number
  closeMode?: 'none' | 'leave' | 'click'
  onChange?: (status: boolean) => void
  ref?: PopoverRef
}

export const Popover: ParentComponent<Props> = (props) => {
  const [open, setOpen] = createSignal(false)
  const propsWithDefaults = mergeProps({
    openDelay: 500,
    closeDelay: 300,
    closeMode: 'leave',
  } satisfies Partial<Props>, props)
  let containerRef!: HTMLDivElement
  let openTimeout: number | undefined
  let closeTimeout: number | undefined
  const [popoverRef, setPopoverRef] = createSignal(null as HTMLDivElement | null)
  const { addGlobalListener, removeGlobalListener } = createGlobalListeners()
  const [style, setStyle] = createSignal<Partial<JSX.CSSProperties>>({})
  let cleanupAutoUpdate: (() => void) | null = null
  const closeEvent = createMemo(() => propsWithDefaults.closeMode === 'click' ? 'click' : 'mousemove')

  // eslint-disable-next-line solid/reactivity
  const calculatePosition = debounce(async () => {
    const pos = await computePosition(containerRef, popoverRef()!, {
      middleware: [offset(4), flip(), shift()],
    })

    setStyle({
      left: `${pos.x}px`,
      top: `${pos.y}px`,
    })
  }, 10)

  const openWithoutDelay = () => {
    openTimeout = undefined

    setOpen(true)
  }

  const openWithDelay = () => {
    openTimeout = window.setTimeout(openWithoutDelay, propsWithDefaults.openDelay)
  }

  const cancelOpen = () => {
    if (openTimeout == null) {
      return
    }

    window.clearTimeout(openTimeout)

    openTimeout = undefined
  }

  const closeWithoutDelay = () => {
    closeTimeout = undefined

    setOpen(false)
  }

  const closeWithDelay = () => {
    closeTimeout = window.setTimeout(closeWithoutDelay, propsWithDefaults.closeDelay)
  }

  const cancelClose = () => {
    if (closeTimeout == null) {
      return
    }

    window.clearTimeout(closeTimeout)
    closeTimeout = undefined
  }

  function removeGlobalEventListener() {
    removeGlobalListener(document, 'click', handleGlobalEvent, true)
    removeGlobalListener(document, 'mousemove', handleGlobalEvent, true)
  }

  function handleGlobalEvent(event: MouseEvent) {
    const target = event.composed ? event.composedPath()[0] as Element : event.target as Element

    if (containerRef.contains(target) || popoverRef()?.contains(target)) {
      return
    }

    cancelOpen()

    if (propsWithDefaults.closeMode !== 'none') {
      closeWithDelay()
    }

    removeGlobalEventListener()
  }

  function handleMouseMove() {
    if (open() || openTimeout != null) {
      return
    }

    addGlobalListener(document, closeEvent(), handleGlobalEvent, true)
    cancelClose()
    openWithDelay()
  }

  function handleMouseLeave() {
    if (open()) {
      return
    }

    cancelOpen()
  }

  createEffect(on(open, (isOpen) => {
    propsWithDefaults.onChange?.(isOpen)
  }))

  createEffect(() => {
    if (open() && popoverRef()) {
      calculatePosition()
    }
  })

  createEffect(on(popoverRef, () => {
    if (popoverRef()) {
      cleanupAutoUpdate = autoUpdate(containerRef, popoverRef()!, calculatePosition, {
        animationFrame: true,
      })

      return
    }

    cleanupAutoUpdate?.()
  }))

  onCleanup(() => {
    removeGlobalEventListener()
    cleanupAutoUpdate?.()
  })

  createExpose(props, () => ({
    close: closeWithoutDelay,
  }))

  return (
    <>
      <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        {propsWithDefaults.trigger}
      </div>
      <Show when={open()}>
        <Portal mount={propsWithDefaults.portTo}>
          <div
            ref={element => setPopoverRef(element)}
            class={clsx('absolute left-[-100vw] top-[-100vh] z-50 w-max')}
            style={style()}
          >
            {propsWithDefaults.children}
          </div>
        </Portal>
      </Show>
    </>
  )
}
