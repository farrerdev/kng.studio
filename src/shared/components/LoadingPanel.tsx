type LoadingPanelProps = {
  variant?: "client" | "admin";
};

export function LoadingPanel({ variant = "client" }: LoadingPanelProps) {
  return (
    <section className={`loading-panel ${variant}`} aria-label="Đang tải" aria-live="polite" aria-busy="true">
      <span className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </section>
  );
}
