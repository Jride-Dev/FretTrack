const MEASUREMENT_FIELDS = [
  ['acMainsVoltageV', 'AC mains at test point (V)', '120.4'],
  ['mainsFrequencyHz', 'Mains frequency (Hz)', '60'],
  ['bPlusStandbyV', 'B+ in standby (V DC)', '455'],
  ['bPlusOperatingV', 'B+ operating under load (V DC)', '420'],
  ['powerTubePlateVoltageV', 'Power-tube plate voltage (V DC)', '415'],
  ['biasCurrentMa', 'Power-tube idle / bias current (mA)', '22 per tube'],
  ['plateDissipationW', 'Calculated plate dissipation (W)', '9.1 per tube'],
  ['outputTransformerPrimaryOhms', 'Output transformer primary resistance (Ω)', ''],
  ['outputTransformerSecondaryOhms', 'Output transformer secondary resistance (Ω)', ''],
  ['speakerVoiceCoilOhms', 'Speaker voice-coil resistance (Ω)', '6.4'],
  ['testLoadOhms', 'Dummy-load impedance (Ω)', '8'],
  ['signalFrequencyHz', 'Signal-generator frequency (Hz)', '1000'],
  ['signalInputMv', 'Signal input level (mV RMS)', '100'],
  ['cleanOutputWatts', 'Clean output before clipping (W)', ''],
  ['clippingOutputWatts', 'Output at recorded clipping point (W)', '']
];

export default function AmplifierElectricalMeasurements({ amplifier, canWrite = true, onMeasurementChange, onDigitalChange }) {
  const measurements = amplifier.electricalMeasurements;
  const digital = amplifier.digitalDiagnostics;

  return (
    <>
      <section className="panel amplifier-electrical-section">
        <h3>Electrical Measurements</h3>
        <p className="amplifier-safety-warning"><strong>Qualified technicians only:</strong> tube amplifiers can retain lethal voltage after power is removed. These fields document measurements; they are not procedural instructions.</p>
        <div className="amplifier-measurement-stages">
          {['initial', 'final'].map((stage) => (
            <fieldset className="amplifier-measurement-stage" key={stage}>
              <legend>{stage === 'initial' ? 'Baseline / Before Service' : 'Final / After Service'}</legend>
              <div className="form-grid amplifier-bench-grid">
                {MEASUREMENT_FIELDS.map(([name, label, placeholder]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      value={measurements[stage][name]}
                      placeholder={placeholder}
                      onChange={(event) => onMeasurementChange(stage, name, event.target.value)}
                      disabled={!canWrite}
                    />
                  </label>
                ))}
                <label className="wide">
                  Power Resistor / Continuity Readings
                  <textarea name="powerResistorReadings" value={measurements[stage].powerResistorReadings} onChange={(event) => onMeasurementChange(stage, 'powerResistorReadings', event.target.value)} rows="3" disabled={!canWrite} placeholder="Component reference, expected value, measured value…" />
                </label>
                <label className="wide">
                  Preamp Stage / Signal-Tracing Voltages
                  <textarea name="preampStageVoltages" value={measurements[stage].preampStageVoltages} onChange={(event) => onMeasurementChange(stage, 'preampStageVoltages', event.target.value)} rows="4" disabled={!canWrite} placeholder="Stage/test point, DC voltage, signal level, clipping or waveform observation…" />
                </label>
                <label className="wide">
                  Measurement Conditions / Notes
                  <textarea name="measurementNotes" value={measurements[stage].measurementNotes} onChange={(event) => onMeasurementChange(stage, 'measurementNotes', event.target.value)} rows="3" disabled={!canWrite} placeholder="Standby state, load, line voltage, control positions, tube positions, meter/probe method…" />
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="panel amplifier-digital-section">
        <h3>Software & Digital Diagnostics</h3>
        <div className="form-grid amplifier-bench-grid">
          <label>
            Firmware Version
            <input name="firmwareVersion" value={digital.firmwareVersion} onChange={(event) => onDigitalChange(event.target.name, event.target.value)} disabled={!canWrite} />
          </label>
          <label>
            Editor / Software Version
            <input name="softwareVersion" value={digital.softwareVersion} onChange={(event) => onDigitalChange(event.target.name, event.target.value)} disabled={!canWrite} />
          </label>
          <label>
            Factory Reset
            <select name="factoryResetStatus" value={digital.factoryResetStatus} onChange={(event) => onDigitalChange(event.target.name, event.target.value)} disabled={!canWrite}>
              <option>Not performed</option>
              <option>Performed — issue remained</option>
              <option>Performed — issue resolved</option>
              <option>Not applicable</option>
            </select>
          </label>
          <label className="wide">
            Customer-Reported Trigger Conditions
            <textarea name="customerTriggerConditions" value={digital.customerTriggerConditions} onChange={(event) => onDigitalChange(event.target.name, event.target.value)} rows="3" disabled={!canWrite} placeholder="Preset, channel, control movement, warm-up time, connected device, or repeatable sequence…" />
          </label>
          <label className="wide">
            Digital Diagnostic Notes
            <textarea name="digitalDiagnosticNotes" value={digital.digitalDiagnosticNotes} onChange={(event) => onDigitalChange(event.target.name, event.target.value)} rows="3" disabled={!canWrite} />
          </label>
        </div>
      </section>
    </>
  );
}
