import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { buildShowPageURL } from '@/object-record/record-show/utils/buildShowPageURL';
import {
  ConfirmationModal,
  StyledCenteredButton,
} from '@/ui/layout/modal/components/ConfirmationModal';
import { openOverrideWorkflowDraftConfirmationModalState } from '@/workflow/states/openOverrideWorkflowDraftConfirmationModalState';
import { WorkflowVersion } from '@/workflow/types/Workflow';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';

export const OverrideWorkflowDraftConfirmationModal = ({
  draftWorkflowVersionId,
  workflowVersionUpdateInput,
  workflowId,
}: {
  draftWorkflowVersionId: string;
  workflowVersionUpdateInput: Pick<WorkflowVersion, 'trigger' | 'steps'>;
  workflowId: string;
}) => {
  const [
    openOverrideWorkflowDraftConfirmationModal,
    setOpenOverrideWorkflowDraftConfirmationModal,
  ] = useRecoilState(openOverrideWorkflowDraftConfirmationModalState);

  const { updateOneRecord: updateOneWorkflowVersion } =
    useUpdateOneRecord<WorkflowVersion>({
      objectNameSingular: CoreObjectNameSingular.WorkflowVersion,
    });

  const navigate = useNavigate();

  const handleOverrideDraft = async () => {
    await updateOneWorkflowVersion({
      idToUpdate: draftWorkflowVersionId,
      updateOneRecordInput: workflowVersionUpdateInput,
    });

    navigate(buildShowPageURL(CoreObjectNameSingular.Workflow, workflowId));
  };

  return (
    <>
      <ConfirmationModal
        isOpen={openOverrideWorkflowDraftConfirmationModal}
        setIsOpen={setOpenOverrideWorkflowDraftConfirmationModal}
        title="A draft already exists"
        subtitle="A draft already exists for this workflow. Are you sure you want to erase it?"
        onConfirmClick={handleOverrideDraft}
        deleteButtonText={'Override Draft'}
        AdditionalButtons={
          <StyledCenteredButton
            to={buildShowPageURL(CoreObjectNameSingular.Workflow, workflowId)}
            onClick={() => {
              setOpenOverrideWorkflowDraftConfirmationModal(false);
            }}
            variant="secondary"
            title="Go to Draft"
            fullWidth
          />
        }
      />
    </>
  );
};
