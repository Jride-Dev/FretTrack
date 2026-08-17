import {
  KEYBOARD_FUNCTION_TESTS,
  KEYBOARD_FUNCTION_TEST_STATUSES
} from './keyboardRepair.js';

const TEST_STAGES = [
  ['initial', 'Initial function test'],
  ['final', 'Final function test']
];

export default function KeyboardFunctionalTests({ keyboard, canWrite = true, onChange }) {
  return (
    <section className="panel keyboard-functional-section">
      <h3>Functional Test Matrix</h3>
      <p className="muted-text">Record the received condition first, then repeat the same checks after repair.</p>
      <div className="keyboard-test-stages">
        {TEST_STAGES.map(([stage, label]) => (
          <fieldset className="keyboard-test-stage" key={stage}>
            <legend>{label}</legend>
            <div className="keyboard-test-grid">
              {KEYBOARD_FUNCTION_TESTS.map(([name, testLabel]) => (
                <label key={name}>
                  {testLabel}
                  <select
                    value={keyboard.functionalTests[stage][name]}
                    onChange={(event) => onChange(stage, name, event.target.value)}
                    disabled={!canWrite}
                  >
                    {KEYBOARD_FUNCTION_TEST_STATUSES.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
