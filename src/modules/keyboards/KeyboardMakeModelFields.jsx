import { getBrandsForInstrumentType, getModelsForBrand } from '../instruments/instrumentService.js';

const KEYBOARD_INSTRUMENT_TYPE = 'Keyboard';

export default function KeyboardMakeModelFields({
  brand = '',
  model = '',
  disabled = false,
  requiredBrand = false,
  listIdPrefix = 'keyboard',
  onChange
}) {
  const brandListId = `${listIdPrefix}-brand-options`;
  const modelListId = `${listIdPrefix}-model-options`;
  const brands = getBrandsForInstrumentType(KEYBOARD_INSTRUMENT_TYPE);
  const models = getModelsForBrand(KEYBOARD_INSTRUMENT_TYPE, brand);

  return (
    <>
      <label>
        Manufacturer
        <input name="guitarBrand" list={brandListId} value={brand} onChange={onChange} disabled={disabled} required={requiredBrand} />
        <datalist id={brandListId}>
          {brands.map((value) => <option key={value} value={value} />)}
        </datalist>
      </label>
      <label>
        Model
        <input name="model" list={modelListId} value={model} onChange={onChange} disabled={disabled} />
        <datalist id={modelListId}>
          {models.map((value) => <option key={value} value={value} />)}
        </datalist>
      </label>
    </>
  );
}
