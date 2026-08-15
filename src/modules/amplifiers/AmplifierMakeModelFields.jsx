import { getBrandsForInstrumentType, getModelsForBrand } from '../instruments/instrumentService.js';

const AMPLIFIER_INSTRUMENT_TYPE = 'Amplifier';

export default function AmplifierMakeModelFields({
  brand = '',
  model = '',
  disabled = false,
  requiredBrand = false,
  listIdPrefix = 'amplifier',
  onChange
}) {
  const brandListId = `${listIdPrefix}-make-options`;
  const modelListId = `${listIdPrefix}-model-options`;
  const brandOptions = getBrandsForInstrumentType(AMPLIFIER_INSTRUMENT_TYPE);
  const modelOptions = getModelsForBrand(AMPLIFIER_INSTRUMENT_TYPE, brand);

  return (
    <>
      <datalist id={brandListId}>
        {brandOptions.map((option) => <option key={option} value={option} />)}
      </datalist>
      <datalist id={modelListId}>
        {modelOptions.map((option) => <option key={option} value={option} />)}
      </datalist>
      <label>
        Manufacturer / Make
        <input
          name="guitarBrand"
          list={brandListId}
          value={brand}
          onChange={onChange}
          placeholder="Select or enter a manufacturer"
          autoComplete="off"
          disabled={disabled}
          required={requiredBrand}
        />
      </label>
      <label>
        Model
        <input
          name="model"
          list={modelListId}
          value={model}
          onChange={onChange}
          placeholder={brand ? 'Select or enter a model' : 'Choose a make first, or enter a model'}
          autoComplete="off"
          disabled={disabled}
        />
      </label>
    </>
  );
}
