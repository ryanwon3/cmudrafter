"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}
export function Header({
  phase,
  connected,
  admin = false,
}: {
  phase?: string;
  connected: boolean;
  admin?: boolean;
}) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="CMU and Pitt In-House home">
        <span className="brand-mark">
          C<span>×</span>P
        </span>
        <span className="brand-type">
          CMU <span>×</span> PITT<small>IN-HOUSE LEAGUE</small>
        </span>
      </a>
      <nav aria-label="Draft progress" className="phase-nav">
        {["Lobby", "Draft", "Results"].map((p, i) => (
          <span
            key={p}
            className={
              (phase === ["lobby", "drafting", "complete"][i]
                ? "active "
                : "") + "nav-phase"
            }
          >
            <span className="phase-dot">{String(i + 1).padStart(2, "0")}</span>
            {p}
          </span>
        ))}
      </nav>
      <span className={"connection " + (connected ? "online" : "")}>
        <i />
        {admin ? "Organizer" : connected ? "Board live" : "Connecting"}
      </span>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>CMU × PITT</span>
      <p>Good teams. Better games.</p>
      <span>COMMUNITY IN-HOUSE · 2026</span>
    </footer>
  );
}
export function Rank({ rank }: { rank: string }) {
  const tier = rank.split(" ")[0].toLowerCase();
  return (
    <span className={"rank " + tier}>
      <span aria-hidden="true" className="rank-gem">
        ◆
      </span>
      {rank.replace(/ \(.*\)/, "")}
    </span>
  );
}
export interface Confirmation {
  title: string;
  description: ReactNode;
  label: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}
export function ConfirmDialog({
  confirmation,
  busy,
  onClose,
  onConfirm,
}: {
  confirmation: Confirmation | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmation && !ref.current?.open) ref.current?.showModal();
    else if (!confirmation) ref.current?.close();
  }, [confirmation]);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="confirm-title"
    >
      <div className="dialog-inner">
        <span className="eyebrow">ONE MORE THING</span>
        <h2 id="confirm-title">{confirmation?.title}</h2>
        <div className="dialog-description">{confirmation?.description}</div>
        <div className="dialog-actions">
          <button
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className={
              "button " + (confirmation?.danger ? "danger" : "primary")
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmation?.label}
            <Arrow />
          </button>
        </div>
      </div>
    </dialog>
  );
}
export function ErrorNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return message ? (
    <div className="error-notice" role="alert">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss message">
        ×
      </button>
    </div>
  ) : null;
}
