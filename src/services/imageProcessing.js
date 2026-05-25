export const IMAGE_OPTIMIZATION_VERSION = 'client-jpeg-v1';

export const IMAGE_UPLOAD_LIMITS = {
  originalWarningBytes: 10 * 1024 * 1024,
  optimizedBlockBytes: 2 * 1024 * 1024,
  allowOriginalUploadOnFailure: false,
  allowLargeOptimizedUpload: false
};

export const IMAGE_OPTIMIZATION_PRESETS = {
  job: {
    maxDimension: 1600,
    quality: 0.78,
    outputType: 'image/jpeg',
    outputExtension: 'jpg'
  },
  damage: {
    maxDimension: 1200,
    quality: 0.8,
    outputType: 'image/jpeg',
    outputExtension: 'jpg'
  },
  shopLogo: {
    maxDimension: 800,
    quality: 0.85,
    outputType: 'image/jpeg',
    outputExtension: 'jpg'
  }
};

const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;
const HEIC_EXTENSIONS = /\.(heic|heif)$/i;
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function prepareImageForStorage(file, originalFileName = file.name, options = {}) {
  const result = await optimizeImageForStorage(file, {
    ...options,
    originalFileName
  });
  return result.file;
}

export async function optimizeImageForStorage(file, options = {}) {
  if (!file) {
    throw new Error('Choose an image file before uploading.');
  }

  const originalFileName = options.originalFileName || file.name || 'image';
  if (!isSupportedImageInput(file, originalFileName)) {
    throw new Error(`${originalFileName} is not a supported image. Use JPG, PNG, WebP, or HEIC/HEIF if your browser supports it.`);
  }

  const preset = getImageOptimizationPreset(options.preset);
  const sourceFile = await convertHeicToJpeg(file, originalFileName, preset.quality);

  try {
    const bitmap = await createImageBitmap(sourceFile, { imageOrientation: 'from-image' });
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    const scale = Math.min(1, preset.maxDimension / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Browser canvas is unavailable.');
    }

    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await canvasToBlob(canvas, preset.outputType, preset.quality);
    if (!blob) {
      throw new Error('Browser image encoder did not return a file.');
    }

    if (!options.allowLargeOptimizedUpload && !IMAGE_UPLOAD_LIMITS.allowLargeOptimizedUpload && blob.size > IMAGE_UPLOAD_LIMITS.optimizedBlockBytes) {
      throw new Error(`Optimized image is still ${formatBytes(blob.size)}, over the ${formatBytes(IMAGE_UPLOAD_LIMITS.optimizedBlockBytes)} upload limit. Try cropping or choosing a smaller photo.`);
    }

    const storedFileName = `${fileNameWithoutExtension(originalFileName)}.${preset.outputExtension}`;
    const optimizedFile = new File([blob], storedFileName, {
      type: preset.outputType,
      lastModified: Date.now()
    });
    const metadata = buildOptimizationMetadata({
      file,
      originalFileName,
      optimizedFile,
      width,
      height,
      originalWidth,
      originalHeight,
      wasResized: scale < 1
    });

    return {
      file: optimizedFile,
      metadata,
      notice: buildOptimizationNotice(metadata)
    };
  } catch (error) {
    if (options.allowOriginalUploadOnFailure || IMAGE_UPLOAD_LIMITS.allowOriginalUploadOnFailure) {
      return {
        file: sourceFile,
        metadata: buildOriginalMetadata(file, sourceFile, originalFileName),
        notice: `Image optimization failed, original uploaded: ${originalFileName}.`
      };
    }

    throw new Error(`Could not optimize ${originalFileName}. ${error instanceof Error ? error.message : 'Try a different image file.'}`.trim());
  }
}

export function getImageOptimizationPreset(presetName = 'job') {
  return IMAGE_OPTIMIZATION_PRESETS[presetName] || IMAGE_OPTIMIZATION_PRESETS.job;
}

export function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function convertHeicToJpeg(file, originalFileName = file.name, quality = IMAGE_OPTIMIZATION_PRESETS.job.quality) {
  if (!isHeicFile(file, originalFileName)) {
    return file;
  }

  try {
    const heic2any = await loadHeic2Any();
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality
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
    throw new Error(`HEIC/HEIF images are not supported by this browser right now. Convert ${originalFileName} to JPG or PNG and try again. ${error instanceof Error ? error.message : ''}`.trim());
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

function buildOptimizationMetadata({
  file,
  originalFileName,
  optimizedFile,
  width,
  height,
  originalWidth,
  originalHeight,
  wasResized
}) {
  const percentSaved = calculatePercentSaved(file.size, optimizedFile.size);
  return {
    originalFileName,
    storedFileName: optimizedFile.name,
    originalSizeBytes: file.size,
    optimizedSizeBytes: optimizedFile.size,
    mimeType: optimizedFile.type || 'image/jpeg',
    width,
    height,
    originalWidth,
    originalHeight,
    optimizationVersion: IMAGE_OPTIMIZATION_VERSION,
    percentSaved,
    wasResized,
    warning: file.size > IMAGE_UPLOAD_LIMITS.originalWarningBytes
      ? `Original image was ${formatBytes(file.size)} before optimization.`
      : ''
  };
}

function buildOriginalMetadata(file, sourceFile, originalFileName) {
  return {
    originalFileName,
    storedFileName: sourceFile.name || originalFileName,
    originalSizeBytes: file.size || sourceFile.size || 0,
    optimizedSizeBytes: sourceFile.size || file.size || 0,
    mimeType: sourceFile.type || file.type || '',
    width: 0,
    height: 0,
    originalWidth: 0,
    originalHeight: 0,
    optimizationVersion: 'original-fallback',
    percentSaved: 0,
    wasResized: false,
    warning: 'Original upload fallback was used.'
  };
}

function buildOptimizationNotice(metadata) {
  const saved = metadata.percentSaved > 0 ? ` (${metadata.percentSaved}% saved)` : '';
  const resized = metadata.wasResized ? `, resized to ${metadata.width}x${metadata.height}` : '';
  return `Image optimized: ${formatBytes(metadata.originalSizeBytes)} -> ${formatBytes(metadata.optimizedSizeBytes)}${saved}${resized}.`;
}

function calculatePercentSaved(originalSize, optimizedSize) {
  if (!originalSize || optimizedSize >= originalSize) {
    return 0;
  }
  return Math.round(((originalSize - optimizedSize) / originalSize) * 100);
}

function fileNameWithoutExtension(fileName) {
  const cleanName = String(fileName || '').trim() || 'image';
  const lastDot = cleanName.lastIndexOf('.');
  return sanitizeFileBaseName(lastDot > 0 ? cleanName.slice(0, lastDot) : cleanName);
}

function sanitizeFileBaseName(fileName) {
  return String(fileName || 'image')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'image';
}

function isSupportedImageInput(file, fileName) {
  const mimeType = String(file?.type || '').toLowerCase();
  return Boolean(
    SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)
    || SUPPORTED_IMAGE_EXTENSIONS.test(fileName || '')
  );
}

function isHeicFile(file, fileName) {
  return /hei[cf]/i.test(file?.type || '') || HEIC_EXTENSIONS.test(fileName || '');
}
