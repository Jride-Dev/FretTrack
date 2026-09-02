export default function WorkspaceSection({
  actions,
  children,
  className = '',
  description,
  title
}) {
  return (
    <section className={`workspace-section ${className}`.trim()}>
      {(title || description || actions) && (
        <div className="workspace-section-heading">
          <div>
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="workspace-section-actions">{actions}</div>}
        </div>
      )}
      <div className="workspace-section-body">{children}</div>
    </section>
  );
}
