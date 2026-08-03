import PhotoEditorModal from '../photos/PhotoEditorModal.jsx';
import JobDocumentEmailDialog from './JobDocumentEmailDialog.jsx';
import SubcontractorPickupEmailDialog from './SubcontractorPickupEmailDialog.jsx';

export default function JobDetailDialogs({
  documentEmailDraft,
  subcontractorPickupJob,
  isSendingSubcontractorEmail,
  photoEditorImage,
  isSavingEditedPhoto,
  canOverwritePhotos,
  onCloseDocumentEmail,
  onSendDocumentEmail,
  onCancelSubcontractorPickup,
  onSendSubcontractorPickup,
  onClosePhotoEditor,
  onSavePhotoCopy,
  onOverwritePhoto
}) {
  return (
    <>
      <JobDocumentEmailDialog
        isOpen={Boolean(documentEmailDraft)}
        draft={documentEmailDraft}
        kind={documentEmailDraft?.kind || 'work_order'}
        onClose={onCloseDocumentEmail}
        onSend={onSendDocumentEmail}
      />
      <SubcontractorPickupEmailDialog
        job={subcontractorPickupJob}
        isSending={isSendingSubcontractorEmail}
        onCancel={onCancelSubcontractorPickup}
        onSend={onSendSubcontractorPickup}
      />
      <PhotoEditorModal
        image={photoEditorImage}
        isOpen={Boolean(photoEditorImage)}
        isSaving={isSavingEditedPhoto}
        onClose={onClosePhotoEditor}
        onSaveCopy={onSavePhotoCopy}
        onOverwrite={canOverwritePhotos ? onOverwritePhoto : null}
      />
    </>
  );
}
