import type { ComponentProps } from 'react';

import WorkOrderBulkDelete from './WorkOrderBulkDelete';
import WorkOrderEditorDialog from './WorkOrderEditorDialog';

type Props = ComponentProps<typeof WorkOrderEditorDialog>;

export default function WorkOrderDialog(props: Props) {
  return (
    <>
      <WorkOrderEditorDialog {...props} />
      <WorkOrderBulkDelete hidden={props.open} />
    </>
  );
}
