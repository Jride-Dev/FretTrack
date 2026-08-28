const PRINT_IMAGE_TIMEOUT_MS = 5000;

function waitForImage(image) {
  if (image.complete) {
    return image.decode?.().catch(() => undefined) || Promise.resolve();
  }

  return new Promise((resolve) => {
    let timeoutId;
    const finish = () => {
      window.clearTimeout(timeoutId);
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      resolve();
    };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    timeoutId = window.setTimeout(finish, PRINT_IMAGE_TIMEOUT_MS);
  });
}

function nextPaint() {
  return new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
}

async function waitForPrintDocumentReady(selector, root = document) {
  const images = Array.from(root.querySelectorAll(`${selector} img`));
  await Promise.all(images.map(waitForImage));
  await nextPaint();
}

export function waitForCustomerReportPrintReady(root = document) {
  return waitForPrintDocumentReady('.print-damage-report', root);
}

export function waitForJobSheetPrintReady(root = document) {
  return waitForPrintDocumentReady('.print-job-sheet', root);
}
