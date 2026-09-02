export default function WorkspacePageHeader({
  actions,
  description,
  eyebrow,
  headingLevel: Heading = 'h2',
  title
}) {
  return (
    <header className="workspace-page-header">
      <div className="workspace-page-titleblock">
        {eyebrow && <span className="workspace-page-eyebrow">{eyebrow}</span>}
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="workspace-page-actions">{actions}</div>}
    </header>
  );
}
