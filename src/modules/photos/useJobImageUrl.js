import { useEffect, useRef, useState } from 'react';
import { resolveJobImageUrl } from './photoUrls.js';

export default function useJobImageUrl(image = {}) {
  const sourceUrl = image.url || '';
  const storagePath = image.storagePath || image.storage_path || '';
  const [displayUrl, setDisplayUrl] = useState(sourceUrl);
  const [isResolving, setIsResolving] = useState(Boolean(storagePath && !sourceUrl));
  const hasRetriedRef = useRef(false);

  useEffect(() => {
    let active = true;
    hasRetriedRef.current = false;
    setDisplayUrl(sourceUrl);
    setIsResolving(Boolean(storagePath));

    if (!storagePath) {
      setIsResolving(false);
      return () => {
        active = false;
      };
    }

    resolveJobImageUrl({ ...image, storagePath })
      .then((resolvedUrl) => {
        if (active) {
          setDisplayUrl(resolvedUrl || sourceUrl);
        }
      })
      .catch((error) => {
        console.error('Stored photo display recovery failed.', error);
      })
      .finally(() => {
        if (active) {
          setIsResolving(false);
        }
      });

    return () => {
      active = false;
    };
  }, [image.id, sourceUrl, storagePath]);

  async function retry() {
    if (hasRetriedRef.current) {
      return displayUrl;
    }
    hasRetriedRef.current = true;
    setIsResolving(true);

    if (!storagePath) {
      setDisplayUrl('');
      setIsResolving(false);
      return '';
    }

    try {
      const resolvedUrl = await resolveJobImageUrl({ ...image, url: '', storagePath });
      setDisplayUrl(resolvedUrl);
      return resolvedUrl;
    } catch (error) {
      console.error('Stored photo display retry failed.', error);
      setDisplayUrl('');
      return '';
    } finally {
      setIsResolving(false);
    }
  }

  return { displayUrl, isResolving, retry };
}
