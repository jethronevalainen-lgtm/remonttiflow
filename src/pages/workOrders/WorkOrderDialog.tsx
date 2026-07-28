import type { ComponentProps } from 'react';

import WorkOrderEditorDialog from './WorkOrderEditorDialog';

type Props = ComponentProps<typeof WorkOrderEditorDialog>;

export default function WorkOrderDialog(props: Props) {
  return <WorkOrderEditorDialog {...props} />;
}
