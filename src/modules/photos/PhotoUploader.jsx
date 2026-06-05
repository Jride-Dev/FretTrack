import { useRef } from 'react';

export default function PhotoUploader({ inputRef, onChange, isImporting = false }) {
  const cameraInputRef = useRef(null);

  return (
    <div className="image-upload no-print">
      <input
        ref={inputRef}
        type="file"
        className="hidden-file-input"
        multiple
        accept="image/*,.heic,.heif"
        onChange={onChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden-file-input"
        accept="image/*"
        capture="environment"
        onChange={onChange}
      />
      <div className="image-upload-actions">
        <button type="button" className="primary-action" onClick={() => cameraInputRef.current?.click()} disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Take Photo'}
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Import from Device'}
        </button>
      </div>
    </div>
  );
}
