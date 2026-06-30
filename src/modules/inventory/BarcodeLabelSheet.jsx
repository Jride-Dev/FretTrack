import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

function getBarcodeValue(part) {
  return part?.barcodeCode ? `FT-PART-${part.barcodeCode}` : '';
}

function normalizeLabelPreset(value) {
  return ['parts_bin_2_25x1_25', 'shipping_4x6', 'letter'].includes(value)
    ? value
    : 'parts_bin_2_25x1_25';
}

export default function BarcodeLabelSheet({ parts = [], labelPreset = 'parts_bin_2_25x1_25' }) {
  const refs = useRef(new Map());
  const normalizedPreset = normalizeLabelPreset(labelPreset);

  useEffect(() => {
    for (const part of parts) {
      const node = refs.current.get(part.id);
      const value = getBarcodeValue(part);
      if (!node || !value) {
        continue;
      }

      try {
        JsBarcode(node, value, {
          format: 'CODE128',
          displayValue: false,
          margin: 0,
          width: 1.4,
          height: 34
        });
      } catch (error) {
        console.error('Barcode render failed.', error);
      }
    }
  }, [parts]);

  if (!parts.length) {
    return (
      <section className={`barcode-label-print-area barcode-label-preset-${normalizedPreset}`}>
        <p className="muted-text">Select one or more parts to preview barcode labels.</p>
      </section>
    );
  }

  return (
    <section className={`barcode-label-print-area barcode-label-preset-${normalizedPreset}`} aria-label="Printable barcode labels">
      <div className="barcode-label-grid">
        {parts.map((part) => {
          const barcodeValue = getBarcodeValue(part);
          return (
            <article className="barcode-label-card" key={part.id}>
              <strong>{part.name}</strong>
              <svg
                aria-label={barcodeValue}
                ref={(node) => {
                  if (node) {
                    refs.current.set(part.id, node);
                  } else {
                    refs.current.delete(part.id);
                  }
                }}
              />
              <code>{barcodeValue || 'Barcode missing'}</code>
              <small>{[part.sku, part.partNumber].filter(Boolean).join(' / ') || 'No UPC or part number'}</small>
              <small>{part.location ? `Location: ${part.location}` : 'No location'}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
