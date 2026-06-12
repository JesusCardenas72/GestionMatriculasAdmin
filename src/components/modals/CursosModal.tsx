import { useState } from "react";
import { GraduationCap, Download, Upload, Archive, X, Loader2 } from "lucide-react";
import type { AppConfig } from "../../../electron/config-store";
import { listarSolicitudes, borrarSolicitud } from "../../api/solicitudes";
import { useCursoContext } from "../../contexts/CursoContextProvider";
import { useCursosConocidos } from "../../hooks/useCursosConocidos";
import { siguienteCurso } from "../../utils/cursoContext";

interface Props {
  config: AppConfig | null;
  onClose: () => void;
}

export default function CursosModal({ config, onClose }: Props) {
  const { curso: cursoActivo, setCurso, tipo } = useCursoContext();
  const { refetch } = useCursosConocidos();
  const [cerrando, setCerrando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);

  const handleExportar = async () => {
    setExportando(true);
    try {
      const resultado = await window.adminAPI.cursos.exportarBackup();
      if (resultado && resultado.length > 0) {
        const lista = resultado.map((r) => r.fileName).join("\n");
        alert(`Backup exportado correctamente:\n${lista}`);
      } else if (resultado === null) {
        // usuario canceló
      } else {
        alert("No había cursos para exportar.");
      }
    } catch (e) {
      alert(`Error al exportar: ${(e as Error).message}`);
    } finally {
      setExportando(false);
    }
  };

  const handleImportar = async () => {
    setImportando(true);
    try {
      const resultado = await window.adminAPI.cursos.importar();
      if (resultado === null) return;
      const resumen = resultado.map((r) => `${r.curso}: ${r.importados} importados, ${r.omitidos} omitidos`).join("\n");
      alert(`Importación completada:\n${resumen}`);
      await refetch();
    } catch (e) {
      alert(`Error al importar: ${(e as Error).message}`);
    } finally {
      setImportando(false);
    }
  };

  const handleCerrarCurso = async () => {
    if (!config?.urlBorrarCurso) {
      alert("No está configurada la URL del flow AdminBorrarCurso.\n\nAñádela en el apartado 'Conexión a Power Automate' para poder cerrar cursos.");
      return;
    }
    if (!window.confirm(`¿Estás seguro de cerrar el curso ${cursoActivo}?\n\nSe realizarán estas acciones:\n1. Archivar localmente el curso.\n2. BORRAR todas las matrículas de este curso en Dataverse.\n3. Cambiar al siguiente curso escolar.`)) return;
    setCerrando(true);
    try {
      await window.adminAPI.cursos.archivar(cursoActivo);
      const listado = await listarSolicitudes(config, undefined, cursoActivo);
      for (const s of listado.solicitudes) {
        await borrarSolicitud(config, { rowId: s.rowId });
      }
      const nuevo = siguienteCurso(cursoActivo);
      setCurso(nuevo);
      await refetch();
      alert(`Curso ${cursoActivo} cerrado. Ahora estás en ${nuevo}.`);
      onClose();
    } catch (e) {
      alert(`Error al cerrar el curso: ${(e as Error).message}`);
    } finally {
      setCerrando(false);
    }
  };

  const puedeCerrar = tipo !== "historico";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md rounded-xl shadow-xl" style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}>
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ background: "var(--tc-card)", borderColor: "var(--tc-border)" }}>
          <GraduationCap className="w-6 h-6" style={{ color: "var(--tc-primary)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--tc-ink)" }}>Cursos Escolares</h2>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg transition-colors" style={{ color: "var(--tc-ink-mute)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-primary-tint)"; e.currentTarget.style.color = "var(--tc-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--tc-ink-mute)"; }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-3">
          <button type="button" onClick={handleExportar} disabled={exportando} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium disabled:opacity-50" style={{ background: "var(--tc-bg)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}>
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportando ? "Exportando…" : "Exportar backup de todos los cursos"}
          </button>

          <button type="button" onClick={handleImportar} disabled={importando} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium disabled:opacity-50" style={{ background: "var(--tc-bg)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}>
            {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importando ? "Importando…" : "Importar datos JSON"}
          </button>

          {puedeCerrar && (
            <button type="button" onClick={handleCerrarCurso} disabled={cerrando} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium disabled:opacity-50" style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger-ink)", border: "1px solid var(--tc-danger-border)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg)"; }}>
              <Archive className="w-4 h-4" />
              {cerrando ? "Cerrando curso…" : `Cerrar curso ${cursoActivo} e iniciar nuevo`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}