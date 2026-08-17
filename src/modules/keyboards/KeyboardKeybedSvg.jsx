import { getKeyboardFault, isBlackMidiNote, midiNoteLabel } from './keyboardDiagnostics.js';

const WHITE_KEY_WIDTH = 28;
const WHITE_KEY_HEIGHT = 132;
const BLACK_KEY_WIDTH = 18;
const BLACK_KEY_HEIGHT = 82;

function keyTone(state, preview, faultCodes) {
  if (preview) return getKeyboardFault(preview.faultCode, faultCodes).overlayTone || 'dead';
  if (!state) return 'neutral';
  if (state.conditionStatus === 'pass') return 'good';
  if (state.conditionStatus !== 'fault') return 'neutral';
  return getKeyboardFault(state.faultCode, faultCodes).overlayTone || (state.damageStatus === 'dirty' ? 'dirty' : state.damageStatus === 'structural' ? 'mechanical' : 'dead');
}

export default function KeyboardKeybedSvg({
  keyRange,
  statesByNote,
  midiFindingsByNote,
  selectedMidiNote,
  faultCodes,
  onSelect
}) {
  let whiteIndex = 0;
  const keys = keyRange.map((midiNote) => {
    const black = isBlackMidiNote(midiNote);
    const x = black ? Math.max(0, whiteIndex * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2) : whiteIndex++ * WHITE_KEY_WIDTH;
    return { midiNote, black, x };
  });
  const width = Math.max(WHITE_KEY_WIDTH, whiteIndex * WHITE_KEY_WIDTH);
  const orderedKeys = [...keys.filter((key) => !key.black), ...keys.filter((key) => key.black)];

  return (
    <div className="keyboard-keybed-scroll" data-testid="keyboard-keybed-svg">
      <svg
        className="keyboard-keybed-svg"
        viewBox={`0 0 ${width} ${WHITE_KEY_HEIGHT}`}
        width={width}
        height={WHITE_KEY_HEIGHT}
        role="group"
        aria-label="Keyboard keybed diagnostic map"
      >
        {orderedKeys.map(({ midiNote, black, x }) => {
          const state = statesByNote.get(midiNote);
          const preview = midiFindingsByNote.get(midiNote);
          const fault = state?.faultCode ? getKeyboardFault(state.faultCode, faultCodes) : null;
          const previewFault = preview ? getKeyboardFault(preview.faultCode, faultCodes) : null;
          const label = `${midiNoteLabel(midiNote)}${fault ? `, ${fault.label}` : previewFault ? `, MIDI preview: ${previewFault.label}` : ', no finding'}`;
          const activate = () => onSelect(midiNote);
          return (
            <g
              key={midiNote}
              className={[
                'keyboard-svg-key',
                black ? 'black' : 'white',
                `tone-${keyTone(state, preview, faultCodes)}`,
                preview ? 'midi-preview' : '',
                selectedMidiNote === midiNote ? 'selected' : ''
              ].filter(Boolean).join(' ')}
              role="button"
              tabIndex="0"
              aria-label={label}
              onClick={activate}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  activate();
                }
              }}
            >
              <rect x={x} y="0" width={black ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH} height={black ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT} rx="2" />
              {!black && <text x={x + WHITE_KEY_WIDTH / 2} y={WHITE_KEY_HEIGHT - 8} textAnchor="middle">{midiNoteLabel(midiNote)}</text>}
              <title>{label}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
