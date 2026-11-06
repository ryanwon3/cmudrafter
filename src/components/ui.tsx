"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { SiteTransition, transitionScreen } from "./site-transition";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}
export function Header({
  phase,
  connected,
  admin = false,
  activePage,
}: {
  phase?: string;
  connected: boolean;
  admin?: boolean;
  activePage?: "bracket";
}) {
  return (
    <>
    <header className="site-header">
      <a className="brand" href="/" aria-label="Draft home">
        Team draft
      </a>
      <nav aria-label="Draft progress" className="phase-nav">
        {["Lobby", "Draft", "Results"].map((p, i) => (
          <span
            key={p}
            className={
              (!activePage && (phase === "review" ? "drafting" : phase) ===
              ["lobby", "drafting", "complete"][i]
                ? "active "
                : "") + "nav-phase"
            }
          >
            {p}
          </span>
        ))}
        {(phase === "complete" || activePage === "bracket") && (
          <a className={"nav-phase" + (activePage === "bracket" ? " active" : "")} href="/bracket">
            Bracket
          </a>
        )}
      </nav>
      <div className="header-actions">
        {!admin && (
          <a className="admin-login-link" href="/admin">
            Admin login
          </a>
        )}
        <span className={"connection " + (connected ? "online" : "")}>
          <i />
          {connected ? "Live" : "Connecting"}
        </span>
      </div>
    </header>
    <SiteTransition screen={transitionScreen(phase,activePage)} />
    </>
  );
}
export function Rank({ rank }: { rank: string }) {
  const tier = rank.split(" ")[0].toLowerCase();
  return <span className={"rank " + tier}>{rank.replace(/ \(.*\)/, "")}</span>;
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
