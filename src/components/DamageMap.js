import { useRef, useState } from 'react';

const damageAreas = [
  'Tuners',
  'Nut',
  'Frets',
  'Fret Sprout',
  'Fret Divots',
  'Neck',
  'Strings',
  'Body',
  'Bridge',
  'Saddles',
  'Input Jack',
  'Pickups',
  'Controls',
  'Tremolo Bar',
  'Strap Button',
  'Other'
];

const severities = ['Cosmetic', 'Structural', 'Critical'];
const viewOptions = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'headstock', label: 'Headstock' },
  { value: 'serial_number', label: 'Serial Number' }
];

const DAMAGE_IMAGE_MAX_EDGE = 1400;
const DAMAGE_IMAGE_QUALITY = 0.85;

function markerColor(severity) {
  if (severity === 'Critical') return '#b3261e';
  if (severity === 'Structural') return '#a15c00';
  return '#255f85';
}

async function readFileAsDataUrl(file) {
  const imageFile = await prepareDamageImage(file, file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
}

async function prepareDamageImage(file) {
  const sourceFile = await convertHeicToJpeg(file, file.name);

  if (!sourceFile?.type.startsWith('image/')) {
    return sourceFile;
  }

  try {
    const bitmap = await createImageBitmap(sourceFile, { imageOrientation: 'from-image' });
    const scale = Math.min(1, DAMAGE_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', DAMAGE_IMAGE_QUALITY));
    if (!blob || blob.size >= sourceFile.size) {
      return sourceFile;
    }

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'damage-photo'}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('Damage image compression failed. Using original file.', error);
    return sourceFile;
  }
}

async function convertHeicToJpeg(file, fileName) {
  if (!/\.(heic|heif)$/i.test(fileName || '')) {
    return file;
  }

  const heic2any = await loadHeic2Any();
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: DAMAGE_IMAGE_QUALITY
  });
  const jpegBlob = Array.isArray(converted) ? converted[0] : converted;

  if (!jpegBlob) {
    throw new Error(`Could not convert ${fileName} from HEIC/HEIF to JPEG.`);
  }

  return new File([jpegBlob], `${fileName.replace(/\.[^.]+$/, '') || 'damage-photo'}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
}

async function loadHeic2Any() {
  const module = await import('heic2any');
  return module.default || module;
}

export default function DamageMap({ canWrite = true, instrumentType = 'Electric', damageMap = {}, onChange, onViewImageUpload }) {
  const [importError, setImportError] = useState('');
  const viewImageInputRef = useRef(null);
  const viewCameraInputRef = useRef(null);
  const markerInputRefs = useRef({});
  const selectedView = viewOptions.some((option) => option.value === damageMap.selectedView) ? damageMap.selectedView : 'front';
  const selectedArea = damageMap.selectedArea || 'Body';
  const selectedSeverity = damageMap.selectedSeverity || 'Cosmetic';
  const views = damageMap.views || {};
  const currentView = views[selectedView] || { marks: [] };
  const marks = currentView.marks || [];
  const imageUrl = currentView.imageUrl || '';
  const canvasClassName = `damage-canvas ${instrumentType.toLowerCase()}-${selectedView}-damage-canvas ${imageUrl ? 'has-damage-image' : 'empty-damage-canvas'}`;

  function updateMap(patch) {
    if (!canWrite) {
      return;
    }
    onChange({
      ...damageMap,
      selectedArea,
      selectedSeverity,
      selectedView,
      views: {
        front: { marks: [], ...(views.front || {}) },
        back: { marks: [], ...(views.back || {}) },
        headstock: { marks: [], ...(views.headstock || {}) },
        serial_number: { marks: [], ...(views.serial_number || {}) }
      },
      ...patch
    });
  }

  function updateCurrentView(patch) {
    updateMap({
      views: {
        front: { marks: [], ...(views.front || {}) },
        back: { marks: [], ...(views.back || {}) },
        headstock: { marks: [], ...(views.headstock || {}) },
        serial_number: { marks: [], ...(views.serial_number || {}) },
        [selectedView]: {
          ...currentView,
          marks,
          ...patch
        }
      }
    });
  }

  function addMark(event) {
    if (!canWrite) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    updateCurrentView({
      marks: [
        ...marks,
        {
          id: crypto.randomUUID(),
          area: selectedArea,
          severity: selectedSeverity,
          note: '',
          recommendedRepair: '',
          photoUrl: '',
          photoName: '',
          storagePath: '',
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y))
        }
      ]
    });
  }

  function updateMark(markId, patch) {
    if (!canWrite) {
      return;
    }
    updateCurrentView({
      marks: marks.map((mark) => (mark.id === markId ? { ...mark, ...patch } : mark))
    });
  }

  function removeMark(markId) {
    if (!canWrite) {
      return;
    }
    updateCurrentView({
      marks: marks.filter((mark) => mark.id !== markId)
    });
  }

  async function attachMarkerPhoto(markId, file) {
    if (!canWrite) {
      return;
    }
    if (!file) {
      return;
    }

    try {
      setImportError('');
      if (onViewImageUpload) {
        try {
          const uploadedImage = await onViewImageUpload(selectedView, file, {
            category: `damage-marker-${selectedView}`
          });
          if (uploadedImage?.url) {
            updateMark(markId, {
              photoUrl: uploadedImage.url,
              photoName: uploadedImage.name || uploadedImage.fileName || file.name,
              photoId: uploadedImage.id || '',
              storagePath: uploadedImage.storagePath || ''
            });
            return;
          }
        } catch (error) {
          console.error('Damage marker photo upload failed. Using local preview.', error);
        }
      }
      updateMark(markId, {
        photoUrl: await readFileAsDataUrl(file),
        photoName: file.name,
        storagePath: ''
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Damage photo import failed.');
    }
  }

  async function updateViewImage(file) {
    if (!canWrite) {
      return;
    }
    if (!file) {
      return;
    }

    try {
      setImportError('');
      if (onViewImageUpload) {
        try {
          const uploadedImage = await onViewImageUpload(selectedView, file);
          if (uploadedImage?.url) {
            updateCurrentView({
              imageUrl: uploadedImage.url,
              imageName: uploadedImage.name || uploadedImage.fileName || file.name,
              imageId: uploadedImage.id || '',
              storagePath: uploadedImage.storagePath || ''
            });
            return;
          }
        } catch (error) {
          console.error('Damage view image upload failed. Using local preview.', error);
        }
      }
      updateCurrentView({
        imageUrl: await readFileAsDataUrl(file),
        imageName: file.name,
        storagePath: ''
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Damage view image import failed.');
    }
  }

  return (
    <div className="damage-map">
      <div className="damage-toolbar no-print">
        <label>
          View
          <select value={selectedView} onChange={(event) => updateMap({ selectedView: event.target.value })} disabled={!canWrite}>
            {viewOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Area
          <select value={selectedArea} onChange={(event) => updateMap({ selectedArea: event.target.value })} disabled={!canWrite}>
            {damageAreas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select value={selectedSeverity} onChange={(event) => updateMap({ selectedSeverity: event.target.value })} disabled={!canWrite}>
            {severities.map((severity) => (
              <option key={severity} value={severity}>{severity}</option>
            ))}
          </select>
        </label>
        <label>
          View Image
          <input
            ref={viewImageInputRef}
            type="file"
            className="hidden-file-input"
            accept="image/*,.heic,.heif"
            disabled={!canWrite}
            onChange={(event) => {
              updateViewImage(event.target.files[0]);
              event.target.value = '';
            }}
          />
          <input
            ref={viewCameraInputRef}
            type="file"
            className="hidden-file-input"
            accept="image/*"
            capture="environment"
            disabled={!canWrite}
            onChange={(event) => {
              updateViewImage(event.target.files[0]);
              event.target.value = '';
            }}
          />
          <div className="image-upload-actions damage-import-actions">
            <button type="button" className="primary-action" onClick={() => viewCameraInputRef.current?.click()} disabled={!canWrite}>Take Photo</button>
            <button type="button" onClick={() => viewImageInputRef.current?.click()} disabled={!canWrite}>Import from Device</button>
          </div>
        </label>
      </div>
      {importError && <p className="import-error no-print">{importError}</p>}

      <button
        type="button"
        className={canvasClassName}
        onClick={addMark}
        aria-label={`Mark damage on ${instrumentType} ${selectedView} diagram`}
        disabled={!canWrite}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={`${instrumentType} ${selectedView} inspection diagram`} draggable="false" />
        ) : (
          <span className="damage-canvas-empty">
            Import an instrument photo or diagram to mark damage.
          </span>
        )}
        <span className="damage-mark-layer" aria-hidden="true">
          {marks.map((mark, index) => (
            <span
              key={mark.id}
              className="damage-marker"
              style={{
                left: `${mark.x}%`,
                top: `${mark.y}%`,
                backgroundColor: markerColor(mark.severity)
              }}
              title={`${mark.area} - ${mark.severity}`}
            >
              {index + 1}
            </span>
          ))}
        </span>
      </button>

      {marks.length > 0 && (
        <div className="damage-list">
          {marks.map((mark, index) => (
            <div key={mark.id} className="damage-row damage-row-expanded">
              <strong>{index + 1}</strong>
              <select value={mark.area} onChange={(event) => updateMark(mark.id, { area: event.target.value })} disabled={!canWrite}>
                {damageAreas.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
              <select value={mark.severity} onChange={(event) => updateMark(mark.id, { severity: event.target.value })} disabled={!canWrite}>
                {severities.map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
              <input
                value={mark.note || ''}
                placeholder="Damage note, e.g. finish crack, not wood"
                onChange={(event) => updateMark(mark.id, { note: event.target.value })}
                disabled={!canWrite}
              />
              <input
                value={mark.recommendedRepair || ''}
                placeholder="Recommended repair"
                onChange={(event) => updateMark(mark.id, { recommendedRepair: event.target.value })}
                disabled={!canWrite}
              />
              <label className="marker-photo-control no-print">
                Photo
                <input
                  ref={(element) => {
                    markerInputRefs.current[mark.id] = element;
                  }}
                  type="file"
                  className="hidden-file-input"
                  accept="image/*,.heic,.heif"
                  capture="environment"
                  disabled={!canWrite}
                  onChange={(event) => {
                    attachMarkerPhoto(mark.id, event.target.files[0]);
                    event.target.value = '';
                  }}
                />
                <button type="button" onClick={() => markerInputRefs.current[mark.id]?.click()} disabled={!canWrite}>
                  {mark.photoUrl ? 'Replace Photo' : 'Import from Device'}
                </button>
              </label>
              {mark.photoUrl && (
                <div className="marker-photo-link">
                  <img src={mark.photoUrl} alt={mark.photoName || `Damage mark ${index + 1} photo`} />
                  <span>{mark.photoName || 'View photo'}</span>
                  <button
                    type="button"
                    className="button-tertiary no-print"
                    onClick={() => updateMark(mark.id, {
                      photoUrl: '',
                      photoName: '',
                      photoId: '',
                      storagePath: ''
                    })}
                    disabled={!canWrite}
                  >
                    Remove Photo
                  </button>
                </div>
              )}
              <button
                type="button"
                className="damage-remove no-print"
                onClick={() => removeMark(mark.id)}
                aria-label={`Remove damage mark ${index + 1}`}
                title={`Remove damage mark ${index + 1}`}
                disabled={!canWrite}
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="damage-liability">
        <input
          type="checkbox"
          checked={Boolean(damageMap.liabilityAcknowledged)}
          onChange={(event) => updateMap({ liabilityAcknowledged: event.target.checked })}
          disabled={!canWrite}
        />
        Customer acknowledges documented condition and authorizes repair intake.
      </label>
      <label>
        Liability / Authorization Notes
        <textarea
          value={damageMap.liabilityText || ''}
          onChange={(event) => updateMap({ liabilityText: event.target.value })}
          rows="3"
          disabled={!canWrite}
        />
      </label>
    </div>
  );
}
