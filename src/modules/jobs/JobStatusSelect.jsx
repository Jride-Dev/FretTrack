export const JOB_STATUSES = [
  "Checked In",
  "On Bench",
  "Waiting Parts",
  "Completed",
  "Picked Up",
  "Cancelled"
];

export default function JobStatusSelect({ value, onChange }) {
  return (
    <label>
      Status
      <select name="status" value={value} onChange={onChange}>
        {JOB_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </label>
  );
}
