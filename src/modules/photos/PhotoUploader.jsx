export default function PhotoUploader({ inputRef, onChange, isImporting = false }) {
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
      <button type="button" onClick={() => inputRef.current?.click()} disabled={isImporting}>
        {isImporting ? 'Importing...' : 'Import from Device'}
      </button>
    </div>
  );
}
