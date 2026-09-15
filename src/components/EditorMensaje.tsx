import { useEffect, useRef, useState } from "react";

/**
 * Editor de texto enriquecido de las ventanas de envío de correo: negrita,
 * cursiva, subrayado, tamaño, color, enlaces y quitar formato. Devuelve HTML.
 *
 * `value` solo se usa como contenido inicial al montar: después el editor es
 * dueño de su contenido y avisa de cada cambio con `onChange`.
 */
export function EditorMensaje({
  value,
  onChange,
  disabled,
  placeholder,
  minHeight = 80,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && value && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
    // Solo al montar: después el contenido lo lleva el propio editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitir = () => onChange(editorRef.current?.innerHTML ?? "");

  function execCmd(cmd: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    emitir();
  }

  function handleFontSize(size: string) {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    const fontEls = editorRef.current?.querySelectorAll('font[size="7"]');
    fontEls?.forEach((el) => {
      const span = document.createElement("span");
      span.style.fontSize = size;
      span.innerHTML = el.innerHTML;
      el.replaceWith(span);
    });
    emitir();
  }

  function openLinkDialog() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      setLinkText(sel.toString());
    }
    setLinkUrl("");
    setLinkDialogOpen(true);
  }

  function insertLink() {
    if (!linkUrl) { setLinkDialogOpen(false); return; }
    const sel = window.getSelection();
    if (savedRangeRef.current) {
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    editorRef.current?.focus();
    if (linkText && (!sel || sel.isCollapsed)) {
      document.execCommand("insertHTML", false,
        `<a href="${linkUrl}" style="color:#6d28d9;text-decoration:underline;">${linkText}</a>`);
    } else {
      document.execCommand("createLink", false, linkUrl);
      const links = editorRef.current?.querySelectorAll(`a[href="${linkUrl}"]`);
      links?.forEach((a) => {
        (a as HTMLElement).style.color = "#6d28d9";
        (a as HTMLElement).style.textDecoration = "underline";
      });
    }
    emitir();
    setLinkDialogOpen(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 rounded-t-lg border border-b-0" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
        <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); execCmd("bold"); }} className="px-2 py-0.5 rounded text-sm font-bold hover:bg-[var(--tc-border)] disabled:opacity-40 transition" style={{ color: "var(--tc-ink)", minWidth: "28px" }} title="Negrita (Ctrl+B)">B</button>
        <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); execCmd("italic"); }} className="px-2 py-0.5 rounded text-sm italic hover:bg-[var(--tc-border)] disabled:opacity-40 transition" style={{ color: "var(--tc-ink)", minWidth: "28px" }} title="Cursiva (Ctrl+I)">I</button>
        <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); execCmd("underline"); }} className="px-2 py-0.5 rounded text-sm underline hover:bg-[var(--tc-border)] disabled:opacity-40 transition" style={{ color: "var(--tc-ink)", minWidth: "28px" }} title="Subrayado (Ctrl+U)">S</button>
        <div className="w-px h-4 mx-0.5" style={{ background: "var(--tc-border)" }} />
        <select
          disabled={disabled}
          onChange={(e) => { e.preventDefault(); handleFontSize(e.target.value); e.target.value = ""; }}
          defaultValue=""
          className="text-[11px] px-1 py-0.5 rounded border outline-none disabled:opacity-40 cursor-pointer"
          style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)" }}
          title="Tamaño de fuente"
        >
          <option value="" disabled>Tamaño</option>
          <option value="11px">11px</option>
          <option value="13px">13px</option>
          <option value="15px">15px (normal)</option>
          <option value="18px">18px</option>
          <option value="22px">22px</option>
          <option value="28px">28px</option>
        </select>
        <div className="w-px h-4 mx-0.5" style={{ background: "var(--tc-border)" }} />
        <div className="relative">
          <input ref={colorInputRef} type="color" className="absolute opacity-0 w-0 h-0 pointer-events-none" disabled={disabled} onChange={(e) => execCmd("foreColor", e.target.value)} />
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click(); }} className="flex flex-col items-center justify-center px-2 py-0.5 rounded hover:bg-[var(--tc-border)] disabled:opacity-40 transition gap-0.5" title="Color de texto">
            <span className="text-sm font-bold leading-none" style={{ color: "var(--tc-ink)" }}>A</span>
            <span className="block w-4 h-1 rounded-sm" style={{ background: "var(--tc-primary)" }} />
          </button>
        </div>
        <div className="w-px h-4 mx-0.5" style={{ background: "var(--tc-border)" }} />
        <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); openLinkDialog(); }} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:bg-[var(--tc-border)] disabled:opacity-40 transition" style={{ color: "var(--tc-ink)" }} title="Insertar enlace">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          Enlace
        </button>
        <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); execCmd("removeFormat"); }} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:bg-[var(--tc-border)] disabled:opacity-40 transition ml-auto" style={{ color: "var(--tc-ink-mute)" }} title="Quitar formato">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M5 20h6" /><path d="M13 4 8 20" /><line x1="22" y1="4" x2="10" y2="16" /></svg>
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitir}
        data-placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-b-lg border text-sm outline-none ${disabled ? "opacity-60 pointer-events-none" : ""}`}
        style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)", lineHeight: "1.6", wordBreak: "break-word", minHeight }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--tc-primary)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--tc-border)")}
      />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: var(--tc-ink-mute);
          pointer-events: none;
          font-style: italic;
        }
      `}</style>
      {linkDialogOpen && (
        <div className="mt-2 p-3 rounded-lg border space-y-2" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--tc-ink-soft)" }}>Insertar enlace</p>
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            onKeyDown={(e) => { if (e.key === "Enter") insertLink(); if (e.key === "Escape") setLinkDialogOpen(false); }}
            className="w-full px-2 py-1.5 rounded border text-sm outline-none focus:border-[var(--tc-primary)]"
            style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)" }}
          />
          {!linkText && (
            <input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Texto del enlace (opcional si ya tienes texto seleccionado)"
              className="w-full px-2 py-1.5 rounded border text-sm outline-none focus:border-[var(--tc-primary)]"
              style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)" }}
            />
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLinkDialogOpen(false)} className="px-3 py-1 rounded text-xs" style={{ color: "var(--tc-ink-mute)" }}>Cancelar</button>
            <button type="button" onClick={insertLink} className="px-3 py-1 rounded text-xs font-medium text-white" style={{ background: "var(--tc-primary)" }}>Insertar</button>
          </div>
        </div>
      )}
    </>
  );
}
