import type { ParentProps } from 'solid-js'
import { createRenderEffect } from 'solid-js'

export function createExpose<
  TargetProps extends ParentProps<{ ref?: unknown }>,
  TargetRefScope extends TargetProps['ref'],
>(
  props: TargetProps,
  exposed: () => NonNullable<TargetRefScope>,
) {
  createRenderEffect(() => {
    if (!(props instanceof Object) || !('ref' in props) || !props.ref) {
      return
    }

    if (typeof props.ref !== 'function') {
      throw new TypeError(
        'Unexpected ref type. Expected a function to set the ref.',
      )
    }

    props.ref(exposed())
  })
}
