const IMAGE_MAX_EDGE = 1800;
const IMAGE_QUALITY = 0.88;

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function prepareImageForStorage(file, originalFileName = file.name) {
  const sourceFile = await convertHeicToJpeg(file, originalFileName);

  if (!sourceFile.type.startsWith('image/')) {
    return sourceFile;
  }

  try {
    const bitmap = await createImageBitmap(sourceFile, { imageOrientation: 'from-image' });
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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

    const blob = await canvasToBlob(canvas, 'image/jpeg', IMAGE_QUALITY);
    if (!blob || blob.size >= sourceFile.size) {
      return sourceFile;
    }

    return new File([blob], `${fileNameWithoutExtension(originalFileName)}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  } catch (error) {
    console.error('Image compression failed. Uploading original file.', error);
    return sourceFile;
  }
}

async function convertHeicToJpeg(file, originalFileName = file.name) {
  if (!isHeicFile(originalFileName)) {
    return file;
  }

  try {
    const heic2any = await loadHeic2Any();
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: IMAGE_QUALITY
    });
    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;

    if (!jpegBlob) {
      throw new Error('HEIC conversion returned no image data.');
    }

    return new File([jpegBlob], `${fileNameWithoutExtension(originalFileName)}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  } catch (error) {
    throw new Error(`Could not convert ${originalFileName} from HEIC/HEIF to JPEG. ${error instanceof Error ? error.message : ''}`.trim());
  }
}

async function loadHeic2Any() {
  const module = await import('heic2any');
  return module.default || module;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function fileNameWithoutExtension(fileName) {
  const cleanName = fileName.trim() || 'job-image';
  const lastDot = cleanName.lastIndexOf('.');
  return lastDot > 0 ? cleanName.slice(0, lastDot) : cleanName;
}

function isHeicFile(fileName) {
  return /\.(heic|heif)$/i.test(fileName || '');
}
