import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Leave without saving?';

export default function useUnsavedChanges({
  initialDirty = false,
  message = DEFAULT_UNSAVED_CHANGES_MESSAGE,
  enabled = true
} = {}) {
  const [isDirty, setIsDirty] = useState(Boolean(initialDirty));

  const setDirty = useCallback((value) => {
    setIsDirty(Boolean(value));
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const confirmIfDirty = useCallback(() => {
    if (!enabled || !isDirty) {
      return true;
    }

    return window.confirm(message);
  }, [enabled, isDirty, message]);

  useEffect(() => {
    if (!enabled || !isDirty) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = message;
      return message;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, isDirty, message]);

  return {
    isDirty,
    markDirty,
    markClean,
    setDirty,
    confirmIfDirty
  };
}
