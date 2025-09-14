import { useAppContext } from '~/logic/app-context'

export default function SharedSubtitle() {
  const app = useAppContext()

  return (
    <p class="mt-2 opacity-50">
      This is the
      {' '}
      {app.context}
      {' '}
      page
    </p>
  )
}
