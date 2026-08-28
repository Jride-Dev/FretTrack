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

export async function waitForCustomerReportPrintReady(root = document) {
  const images = Array.from(root.querySelectorAll('.print-damage-report img'));
  await Promise.all(images.map(waitForImage));
  await nextPaint();
}
