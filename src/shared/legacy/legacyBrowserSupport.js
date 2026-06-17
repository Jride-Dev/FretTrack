import { logLegacyDebug, logLegacyFeatureSnapshot } from './legacyDebug';

function defineValue(target, propertyName, value) {
  try {
    Object.defineProperty(target, propertyName, {
      configurable: true,
      writable: true,
      value
    });
  } catch {
    target[propertyName] = value;
  }
}

if (!Object.hasOwn) {
  defineValue(Object, 'hasOwn', (object, propertyName) => Object.prototype.hasOwnProperty.call(Object(object), propertyName));
}

if (!Array.prototype.at) {
  defineValue(Array.prototype, 'at', function at(index) {
    const length = this == null ? 0 : this.length >>> 0;
    const relativeIndex = Math.trunc(Number(index) || 0);
    const resolvedIndex = relativeIndex >= 0 ? relativeIndex : length + relativeIndex;
    return resolvedIndex < 0 || resolvedIndex >= length ? undefined : this[resolvedIndex];
  });
}

if (window.Promise && !window.Promise.prototype.finally) {
  defineValue(window.Promise.prototype, 'finally', function promiseFinally(callback) {
    const PromiseConstructor = this.constructor || window.Promise;
    return this.then(
      (value) => PromiseConstructor.resolve(callback()).then(() => value),
      (reason) => PromiseConstructor.resolve(callback()).then(() => {
        throw reason;
      })
    );
  });
}

if (!window.structuredClone) {
  window.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

if (!window.crypto) {
  window.crypto = {};
}

if (!window.crypto.randomUUID) {
  window.crypto.randomUUID = () => {
    const bytes = new Uint8Array(16);
    if (window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  };
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

try {
  logLegacyDebug('legacy support loaded');
  logLegacyFeatureSnapshot();
} catch {
  // Debug logging must never block app startup on older browsers.
}
