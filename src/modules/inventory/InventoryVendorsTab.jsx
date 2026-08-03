export default function InventoryVendorsTab({
  vendors, selectedVendorId, selectedVendor, vendorForm, setVendorForm,
  canWrite, isSaving, onSelectVendor, onResetVendor, onSaveVendor
}) {
  return (
    <div className="inventory-layout">
      <div className="inventory-table-wrap">
        <table>
          <thead><tr><th>Company</th><th>Sales Rep</th><th>Location</th><th>Email / Website</th><th>Status</th></tr></thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id} className={`${selectedVendorId === vendor.id ? 'selected-row' : ''}${vendor.isActive ? '' : ' inactive-row'}`} onClick={() => onSelectVendor(vendor)}>
                <td><strong>{vendor.name}</strong>{vendor.onlineOnly && <span className="status-pill muted">Online Only</span>}</td>
                <td>{vendor.contactName || '-'}</td>
                <td>{vendor.onlineOnly ? 'Online only' : vendorLocationLabel(vendor) || '-'}</td>
                <td><div className="vendor-list-meta"><span>{vendor.email || '-'}</span>{vendor.website && <span>{vendor.website}</span>}</div></td>
                <td><span className={`status-pill ${vendor.isActive ? 'success' : 'muted'}`}>{vendor.isActive ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
            {!vendors.length && <tr><td colSpan="5">No vendors yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="inventory-editor">
        <form onSubmit={onSaveVendor}>
          <div className="editor-heading">
            <h3>{selectedVendor ? 'Edit Vendor' : 'Add Vendor'}</h3>
            {canWrite && selectedVendor && <button type="button" onClick={onResetVendor}>Cancel</button>}
          </div>
          <div className="form-grid">
            <label>Company<input disabled={!canWrite} required value={vendorForm.name} onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Sales Rep<input disabled={!canWrite} value={vendorForm.contactName} onChange={(event) => setVendorForm((current) => ({ ...current, contactName: event.target.value }))} /></label>
            <label>Email<input disabled={!canWrite} type="email" value={vendorForm.email} onChange={(event) => setVendorForm((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>Website<input disabled={!canWrite} value={vendorForm.website} onChange={(event) => setVendorForm((current) => ({ ...current, website: event.target.value }))} /></label>
          </div>
          <label className="table-checkbox"><input disabled={!canWrite} type="checkbox" checked={vendorForm.onlineOnly} onChange={(event) => setVendorForm((current) => ({ ...current, onlineOnly: event.target.checked }))} />Online Only</label>
          {!vendorForm.onlineOnly && (
            <div className="form-grid">
              <label>Phone<input disabled={!canWrite} value={vendorForm.phone} onChange={(event) => setVendorForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label>Address Line 1<input disabled={!canWrite} value={vendorForm.addressLine1} onChange={(event) => setVendorForm((current) => ({ ...current, addressLine1: event.target.value }))} /></label>
              <label>Address Line 2<input disabled={!canWrite} value={vendorForm.addressLine2} onChange={(event) => setVendorForm((current) => ({ ...current, addressLine2: event.target.value }))} /></label>
              <label>City<input disabled={!canWrite} value={vendorForm.city} onChange={(event) => setVendorForm((current) => ({ ...current, city: event.target.value }))} /></label>
              <label>State / Region<input disabled={!canWrite} value={vendorForm.state} onChange={(event) => setVendorForm((current) => ({ ...current, state: event.target.value }))} /></label>
              <label>Postal Code<input disabled={!canWrite} value={vendorForm.postalCode} onChange={(event) => setVendorForm((current) => ({ ...current, postalCode: event.target.value }))} /></label>
              <label>Country<input disabled={!canWrite} value={vendorForm.country} onChange={(event) => setVendorForm((current) => ({ ...current, country: event.target.value }))} /></label>
            </div>
          )}
          <label>Notes<input disabled={!canWrite} value={vendorForm.notes} onChange={(event) => setVendorForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <label className="table-checkbox"><input disabled={!canWrite} type="checkbox" checked={vendorForm.isActive} onChange={(event) => setVendorForm((current) => ({ ...current, isActive: event.target.checked }))} />Active</label>
          {canWrite && <div className="mode-actions"><button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : selectedVendor ? 'Save Changes' : 'Save Vendor'}</button></div>}
        </form>
      </div>
    </div>
  );
}

function vendorLocationLabel(vendor) {
  const cityState = [vendor?.city, vendor?.state].filter(Boolean).join(', ');
  if (cityState) {
    return cityState;
  }
  return vendor?.addressLine1 || '';
}
