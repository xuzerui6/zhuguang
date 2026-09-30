"use client";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./operation-dialog.module.css";

export function OperationDialog({ title, description, onCancel, onConfirm, initialValue='', minimum=4, children }: {
  title: string; description: string; onCancel: () => void; onConfirm: (reason: string) => Promise<void>;
  initialValue?:string; minimum?:number; children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current; dialog?.showModal(); field.current?.focus();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className={styles.dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} ref={ref}>
    <form onSubmit={async (event) => { event.preventDefault(); if (busy) return; const reason = field.current?.value.trim() || ""; if (reason.length < minimum) { setError(`请填写至少${minimum}字的说明`); return; } setBusy(true); setError(""); try { await onConfirm(reason); } catch (failure) { setError(failure instanceof Error ? failure.message : "操作失败，请重试"); } finally { setBusy(false); } }}>
      <h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{description}</p>
      {children}
      <label htmlFor={`${id}-reason`}>操作原因</label><textarea aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} disabled={busy} id={`${id}-reason`} defaultValue={initialValue} maxLength={500} minLength={minimum} ref={field} required />
      {error ? <p id={`${id}-error`} role="alert">{error}</p> : null}
      <footer><button disabled={busy} onClick={onCancel} type="button">取消</button><button disabled={busy} type="submit">{busy ? "正在提交" : "确认操作"}</button></footer>
    </form>
  </dialog>;
}
