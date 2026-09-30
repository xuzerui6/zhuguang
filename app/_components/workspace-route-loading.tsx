import styles from "./workspace-shell.module.css";

export function WorkspaceRouteLoading({ label = "正在读取工作区" }: { label?: string }) {
  return <div aria-label={label} aria-live="polite" className={styles.routeLoading} role="status">
    <header><span /><span /></header>
    <section><span /><span /><span /></section>
    <section><span /><span /><span /></section>
  </div>;
}
