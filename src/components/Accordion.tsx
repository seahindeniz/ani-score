import type { Component, JSX } from 'solid-js'
import { createContext, createMemo, createSignal, onMount, splitProps, useContext } from 'solid-js'
import { cn } from '~/utils'

interface AccordionContextValue {
  expandedItems: () => Set<string>
  toggleItem: (value: string) => void
  multiple: boolean
  collapsible: boolean
}

const AccordionContext = createContext<AccordionContextValue>()

interface AccordionProps {
  multiple?: boolean
  collapsible?: boolean
  class?: string
  children: JSX.Element
  defaultValue?: string | string[]
}

export const Accordion: Component<AccordionProps> = (props) => {
  const [local, others] = splitProps(props, ['multiple', 'collapsible', 'class', 'children', 'defaultValue'])

  const initialExpanded = new Set<string>(
    local.defaultValue
      ? Array.isArray(local.defaultValue)
        ? local.defaultValue
        : [local.defaultValue]
      : [],
  )

  const [expandedItems, setExpandedItems] = createSignal<Set<string>>(initialExpanded)

  const toggleItem = (value: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)

      if (next.has(value)) {
        if (local.collapsible) {
          next.delete(value)
        }
      }
      else {
        if (!local.multiple) {
          next.clear()
        }
        next.add(value)
      }

      return next
    })
  }

  const contextValue: AccordionContextValue = {
    expandedItems,
    toggleItem,
    get multiple() {
      return local.multiple ?? false
    },
    get collapsible() {
      return local.collapsible ?? true
    },
  }

  return (
    <AccordionContext.Provider value={contextValue}>
      <div class={cn('w-full', local.class)} {...others}>
        {local.children}
      </div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps {
  value: string
  class?: string
  trigger: JSX.Element
  children: JSX.Element
}

export const AccordionItem: Component<AccordionItemProps> = (props) => {
  let contentRef: HTMLDivElement | undefined
  let innerRef: HTMLDivElement | undefined
  const [local, others] = splitProps(props, ['value', 'class', 'trigger', 'children'])
  const context = useContext(AccordionContext)
  const [height, setHeight] = createSignal<number>(0)

  if (!context) {
    throw new Error('AccordionItem must be used within an Accordion')
  }

  const isExpanded = createMemo(() => context.expandedItems().has(local.value))

  const handleToggle = () => {
    context.toggleItem(local.value)
  }

  onMount(() => {
    if (contentRef && innerRef) {
      setHeight(innerRef.offsetHeight)
    }
  })

  return (
    <div
      class={cn('border-b', local.class)}
      data-expanded={isExpanded() ? '' : undefined}
      data-closed={!isExpanded() ? '' : undefined}
      {...others}
    >
      <h3
        class="flex"
        data-expanded={isExpanded() ? '' : undefined}
        data-closed={!isExpanded() ? '' : undefined}
      >
        <button
          type="button"
          aria-expanded={isExpanded()}
          data-expanded={isExpanded() ? '' : undefined}
          data-closed={!isExpanded() ? '' : undefined}
          data-key={local.value}
          onClick={handleToggle}
          class="flex flex-1 items-center justify-between py-2 text-sm font-medium transition-all [&[data-expanded]>svg]:rotate-180 hover:underline"
          aria-controls={isExpanded() ? `accordion-content-${local.value}` : undefined}
        >
          {local.trigger}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4 shrink-0 transition-transform duration-200"
          >
            <path d="M6 9l6 6l6 -6" />
          </svg>
        </button>
      </h3>
      <div
        ref={contentRef}
        id={`accordion-content-${local.value}`}
        data-expanded={isExpanded() ? '' : undefined}
        data-closed={!isExpanded() ? '' : undefined}
        role="region"
        style={{
          '--kb-accordion-content-height': `${height()}px`,
          height: isExpanded() ? 'var(--kb-accordion-content-height)' : '0',
        }}
        class="overflow-hidden text-sm transition-all data-[expanded]:animate-accordion-down data-[closed]:animate-accordion-up"
      >
        <div ref={innerRef}>{local.children}</div>
      </div>
    </div>
  )
}
