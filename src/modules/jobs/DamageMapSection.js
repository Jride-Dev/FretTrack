import DamageMap from '../../components/DamageMap';

export default function DamageMapSection({
  canWrite = true,
  damageMap,
  instrumentType,
  onChange,
  onViewImageUpload
}) {
  return (
    <section>
      <h3>Damage Map</h3>
      <DamageMap
        instrumentType={instrumentType}
        damageMap={damageMap}
        onChange={onChange}
        onViewImageUpload={onViewImageUpload}
        canWrite={canWrite}
      />
    </section>
  );
}
