import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { LOGO_CPM_B64, LOGO_JCCM_B64 } from '../assets/pdf/logos';

const logoCpm = LOGO_CPM_B64;
const logoJccm = LOGO_JCCM_B64;

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface EnrollmentFormData {
  nombre: string;
  apellidos: string;
  dni: string;
  fechaNacimiento: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  email: string;
  telefono: string;
  horaSalidaEstudios: 'Antes de las 17 h' | '17 h' | '18 h' | '';
  disponibilidadManana: boolean;
  autorizacionImagen: boolean;
  tutor1Nombre: string;
  tutor1Dni: string;
  tutor2Nombre: string;
  tutor2Dni: string;
  tipoEnsenanza: 'elemental' | 'profesional' | '';
  curso: string;
  especialidad: string;
  asignaturaPendiente1: string;
  asignaturaPendiente2?: string;
  esRepetidor?: boolean;
  perfilProfesional: 'A' | 'B' | 'C' | '';
  formaPago: 'unico' | 'fraccionado' | 'beca' | '';
  familiaNumerosa: boolean;
  tipoReduccion: 'ninguna' | 'fam_num_general' | 'fam_num_especial' | 'discapacidad' | 'terrorismo' | 'violencia_genero' | 'ingreso_minimo' | '';
  matriculaHonor: boolean;
  esPrimerAno: boolean;
  importeTotal: string;
  importe1erPago?: string;
  importe2oPago?: string;
  convalidacionSolicitada?: boolean;
  convalidacionAsignaturas?: string[];
  convalidacionMotivo?: 'doble' | 'eso_bach' | '';
  academicYear?: string;
}

export interface PendingSubject { id: string; materiaId: string; label: string; }
export interface CurrentSubject { MATERIA: string; DESCRIPCION: string; }

export type CalcResult = {
  details: {
    reductionLabel: string;
    serviciosGenerales: number;
    aperturaExpediente: number;
    curso: number;
    asignaturasPendientes: number;
    matriculaHonorDiscount: number;
    multiplier: number;
    convalidacionDiscount: number;
    convalidacionCount: number;
    repetidorMode?: 'suelta' | 'completo' | null;
  };
} | null;

export interface MatriculaPdfProps {
  formData: EnrollmentFormData;
  academicYear: string;
  submitTimestamp: Date;
  asignaturasCursoActual: CurrentSubject[];
  selectedPendingSubjects: PendingSubject[];
  calculation: CalcResult;
  requestNumber?: string;
  allPendingFromLastCourse?: boolean;
}

// ── Estilos y constantes ──────────────────────────────────────────────────────

const C = {
  bg: '#F5F5F5', white: '#FFFFFF',
  gray50: '#F9FAFB', gray100: '#F3F4F6', gray200: '#E5E7EB',
  gray400: '#9CA3AF', gray500: '#6B7280', gray700: '#374151',
  gray800: '#1F2937', gray900: '#111827',
  blue50: '#EFF6FF', blue200: '#BFDBFE', blue800: '#1E40AF',
  orange50: '#FFF7ED', orange200: '#FED7AA', orange800: '#92400E',
  green50: '#F0FDF4', green100: '#DCFCE7', green200: '#BBF7D0', green700: '#15803D', green800: '#166534',
  purple50: '#FAF5FF', purple100: '#F3E8FF', purple200: '#E9D5FF', purple700: '#7E22CE',
  blue700: '#1D4ED8',
};

const PROFILE_SPECIFIC_SUBJECTS = [
  'Fundamentos de Composición',
  'Improvisación',
  'Informática musical',
  'Didáctica de la Música',
  'Didáctica musical',
  'Coro',
  'Música moderna',
];

const CONVALIDACION_MOTIVO_LABEL: Record<'doble' | 'eso_bach', string> = {
  doble: 'Convalidación por doble especialidad o similar',
  eso_bach: 'Asignaturas de ESO y Bachillerato',
};

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 20, fontSize: 9, color: C.gray900, fontFamily: 'Helvetica' },
  card: { backgroundColor: C.white, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: C.gray100, borderStyle: 'solid' },
  sectionTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.gray100, borderBottomStyle: 'solid' },
  row: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1.5 },
  fieldValue: { fontSize: 9, fontFamily: 'Helvetica', color: C.gray800, backgroundColor: C.gray50, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  fieldValueHighlight: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray800, backgroundColor: C.gray50, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  dotFilled: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.gray900, borderStyle: 'solid', backgroundColor: C.gray900 },
  dotEmpty:  { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.gray500, borderStyle: 'solid' },
  boxFilled: { width: 8, height: 8, borderRadius: 2, borderWidth: 1.5, borderColor: C.gray900, borderStyle: 'solid', backgroundColor: C.gray900 },
  boxEmpty:  { width: 8, height: 8, borderRadius: 2, borderWidth: 1.5, borderColor: C.gray500, borderStyle: 'solid' },
  labelSmall: { fontSize: 7.5, color: C.gray700, fontFamily: 'Helvetica' },
  labelMicro: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.4 },
});

// ── Sub-componentes ───────────────────────────────────────────────────────────

const Field = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <View>
    <Text style={s.fieldLabel}>{label}</Text>
    <Text style={highlight ? s.fieldValueHighlight : s.fieldValue}>{value || '—'}</Text>
  </View>
);

const DesgloseRow = ({ label, value, highlight, discount }: { label: string; value: string; highlight?: boolean; discount?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5, gap: 4 }}>
    <Text style={{ flex: 1, fontSize: 8, color: discount ? C.green700 : C.gray500, fontFamily: discount || highlight ? 'Helvetica-Bold' : 'Helvetica' }}>{label}</Text>
    <Text style={{ flexShrink: 0, fontSize: 8, fontFamily: 'Helvetica-Bold', color: discount ? C.green700 : C.gray800 }}>{value}</Text>
  </View>
);

// ── Componente principal ──────────────────────────────────────────────────────

const MatriculaPdfComponent = ({ formData, academicYear, submitTimestamp, asignaturasCursoActual, selectedPendingSubjects, calculation, requestNumber, allPendingFromLastCourse }: MatriculaPdfProps) => {
  const fechaFmt = formData.fechaNacimiento ? new Date(formData.fechaNacimiento + 'T12:00:00').toLocaleDateString('es-ES') : '';

  const perfilLabel =
    formData.perfilProfesional === 'A' ? 'Fundamentos de Composición'
    : formData.perfilProfesional === 'B' ? (formData.curso.includes('5') ? 'Improvisación / Informática Musical' : 'Didáctica musical / Improvisación')
    : formData.perfilProfesional === 'C' ? (formData.curso.includes('5') ? 'Improvisación / Coro 1' : 'Música moderna / Coro 2')
    : '';

  const showPerfil = !!formData.perfilProfesional && (formData.curso.includes('5') || formData.curso.includes('6')) && formData.tipoEnsenanza === 'profesional';
  const d = calculation?.details;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={{ ...s.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: 10 }}>
          <Image src={logoJccm} style={{ height: 30 }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.gray900 }}>Solicitud de Matrícula</Text>
            <Text style={{ fontSize: 9, color: C.gray500, marginTop: 1 }}>Curso Académico {academicYear}</Text>
            <Text style={{ fontSize: 8, color: C.gray400 }}>C.P.M. "Marcos Redondo", Ciudad Real</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image src={logoCpm} style={{ height: 30 }} />
              {requestNumber && (() => {
                const parts = requestNumber.split('-');
                const counter = parts[parts.length - 1] ?? requestNumber;
                const yearMatch = academicYear.match(/(\d{4})\s*\/\s*(\d{4})/);
                const cursoShort = yearMatch ? `${yearMatch[1].slice(-2)}/${yearMatch[2].slice(-2)}` : '';
                return (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#F97316', lineHeight: 1 }}>
                      #{counter}
                    </Text>
                    {cursoShort && (
                      <Text style={{ fontSize: 8, color: '#F97316', marginTop: 1 }}>
                        Curso {cursoShort}
                      </Text>
                    )}
                  </View>
                );
              })()}
            </View>
            <View style={{ backgroundColor: '#F97316', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white }}>
                Enviado: {submitTimestamp.toLocaleDateString('es-ES')}{' '}
                {submitTimestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Fila 1: Datos Personales (izq) + Forma de Pago (der) ── */}
        <View style={{ flexDirection: 'row', gap: 6 }}>

          {/* Columna izquierda */}
          <View style={{ flex: 3 }}>

            {/* Datos Personales */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Datos Personales</Text>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Nombre" value={formData.nombre} /></View>
                <View style={{ flex: 1.4 }}><Field label="Apellidos" value={formData.apellidos} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="D.N.I. / N.I.E." value={formData.dni} /></View>
                <View style={{ flex: 1 }}><Field label="Fecha de nac." value={fechaFmt} /></View>
                <View style={{ flex: 1.8 }}><Field label="Domicilio actual" value={formData.domicilio} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1.8 }}><Field label="Localidad" value={formData.localidad} /></View>
                <View style={{ flex: 1 }}><Field label="Provincia" value={formData.provincia} /></View>
                <View style={{ flex: 0.8 }}><Field label="C.P." value={formData.codigoPostal} /></View>
              </View>
              <View style={{ ...s.row, marginBottom: 0 }}>
                <View style={{ flex: 1.8 }}><Field label="Correo electrónico" value={formData.email} /></View>
                <View style={{ flex: 1 }}><Field label="Teléfono" value={formData.telefono} /></View>
              </View>
              <View style={{ marginTop: 6, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.gray100, borderTopStyle: 'solid', flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.labelMicro}>Hora salida</Text>
                  {(['<17 h', '17 h', '18 h'] as const).map(h => (
                    <View key={h} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <View style={(formData.horaSalidaEstudios === h || (h === '<17 h' && formData.horaSalidaEstudios === 'Antes de las 17 h')) ? s.dotFilled : s.dotEmpty} />
                      <Text style={s.labelSmall}>{h}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.labelMicro}>Disponib. mañana</Text>
                  {([{ label: 'Si', val: true }, { label: 'No', val: false }]).map(op => (
                    <View key={op.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <View style={formData.disponibilidadManana === op.val ? s.boxFilled : s.boxEmpty} />
                      <Text style={s.labelSmall}>{op.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.labelMicro}>Autorización imagen</Text>
                  {([{ label: 'Si', val: true }, { label: 'No', val: false }]).map(op => (
                    <View key={op.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <View style={formData.autorizacionImagen === op.val ? s.boxFilled : s.boxEmpty} />
                      <Text style={s.labelSmall}>{op.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Menores */}
            {(formData.tutor1Nombre || formData.tutor2Nombre) && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>Menores de 18 años — Tutores Legales</Text>
                {formData.tutor1Nombre && (
                  <View style={s.row}>
                    <View style={{ flex: 3 }}><Field label="Tutor/a Legal 1 (Apellidos y Nombre)" value={formData.tutor1Nombre} /></View>
                    <View style={{ flex: 1 }}><Field label="D.N.I." value={formData.tutor1Dni} /></View>
                  </View>
                )}
                {formData.tutor2Nombre && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={{ flex: 3 }}><Field label="Tutor/a Legal 2 (Apellidos y Nombre)" value={formData.tutor2Nombre} /></View>
                    <View style={{ flex: 1 }}><Field label="D.N.I." value={formData.tutor2Dni} /></View>
                  </View>
                )}
              </View>
            )}

          </View>

          {/* Columna derecha: Forma de Pago */}
          <View style={{ flex: 1.4 }}>
            <View style={s.card}>
              <Text style={s.sectionTitle}>Forma de Pago</Text>
              <View style={{ marginBottom: 8 }}>
                <Field label="Modalidad" value={formData.formaPago === 'unico' ? 'Pago Único' : formData.formaPago === 'fraccionado' ? 'Pago Fraccionado' : formData.formaPago === 'beca' ? 'Solicita Beca' : '—'} />
              </View>

              {/* Desglose */}
              {d && (
                <View style={{ backgroundColor: C.gray50, borderRadius: 5, padding: 8, borderWidth: 1, borderColor: C.gray100, borderStyle: 'solid', marginBottom: 8 }}>
                  <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Desglose de Tasas</Text>
                  <DesgloseRow label={d.repetidorMode ? 'Servicios Generales — Repetidor +20%' : 'Servicios Generales'} value={`${d.serviciosGenerales.toFixed(2)} EUR`} />
                  {d.aperturaExpediente > 0 && <DesgloseRow label={d.repetidorMode ? 'Apertura de Expediente — Repetidor +20%' : 'Apertura de Expediente'} value={`${d.aperturaExpediente.toFixed(2)} EUR`} />}
                  {d.repetidorMode !== 'suelta' && (
                    <DesgloseRow
                      label={d.repetidorMode === 'completo' ? `Matrícula Curso (${formData.curso}) Repetidor +20%` : `Matrícula Curso (${formData.curso})`}
                      value={`${d.curso.toFixed(2)} EUR`}
                    />
                  )}
                  {d.asignaturasPendientes > 0 && (
                    <DesgloseRow
                      label={d.repetidorMode === 'suelta' ? `Asig. Repetidor (+20%)` : 'Asignaturas Pendientes'}
                      value={`${d.asignaturasPendientes.toFixed(2)} EUR`}
                    />
                  )}
                  {d.matriculaHonorDiscount > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: C.gray200, borderTopStyle: 'solid', marginTop: 2 }}>
                      <DesgloseRow label="Matrícula de Honor (Art. 13)" value={`-${d.matriculaHonorDiscount.toFixed(2)} EUR`} discount />
                    </View>
                  )}
                  {d.convalidacionDiscount > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: C.gray200, borderTopStyle: 'solid', marginTop: 2 }}>
                      <DesgloseRow label={`Convalidación (${d.convalidacionCount} asig.)`} value={`-${d.convalidacionDiscount.toFixed(2)} EUR`} discount />
                    </View>
                  )}
                  {d.multiplier < 1 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: C.gray200, borderTopStyle: 'solid', marginTop: 2 }}>
                      <DesgloseRow label="Reducción aplicada" value={`-${((1 - d.multiplier) * 100).toFixed(0)}%`} discount />
                    </View>
                  )}
                </View>
              )}

              {/* Importes */}
              {formData.formaPago !== 'beca' && formData.importeTotal && (
                <View style={{ gap: 4 }}>
                  <Field label="Importe Total (EUR)" value={`${formData.importeTotal} EUR`} highlight />
                  {formData.formaPago === 'fraccionado' && (
                    <>
                      <Field label="1er Pago (EUR)" value={`${formData.importe1erPago} EUR`} />
                      <Field label="2o Pago (EUR)" value={`${formData.importe2oPago} EUR`} />
                    </>
                  )}
                </View>
              )}
              {formData.formaPago === 'beca' && (
                <View style={{ backgroundColor: C.blue50, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: C.blue200, borderStyle: 'solid' }}>
                  <Text style={{ fontSize: 7.5, color: C.blue700 }}>Aporta justificante de solicitud de Beca en plazo.</Text>
                </View>
              )}
              {formData.esPrimerAno && (
                <Text style={{ fontSize: 7, color: C.gray400, marginTop: 4 }}>* Incluye apertura de expediente (25 EUR).</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Fila 2: Datos de Matriculacion — ancho completo ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Datos de Matriculación</Text>
          <View style={s.row}>
            <View style={{ flex: 1.6 }}><Field label="Tipo de Enseñanza" value={formData.tipoEnsenanza === 'elemental' ? 'Enseñanza Elemental' : formData.tipoEnsenanza === 'profesional' ? 'Enseñanza Profesional' : '—'} /></View>
            <View style={{ width: 42 }}><Field label="Curso" value={formData.curso} /></View>
            <View style={{ flex: 1.4 }}><Field label="Especialidad" value={formData.especialidad} /></View>
            {formData.esRepetidor && (
              <View style={{ width: 60 }}>
                <Text style={s.fieldLabel}>Repetidor</Text>
                <View style={{ backgroundColor: C.gray900, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4, alignItems: 'center' }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.white }}>SI</Text>
                </View>
              </View>
            )}
            <View style={{ flex: 1.4 }}>
              {showPerfil ? (
                <>
                  <Text style={s.fieldLabel}>Perfil Elegido</Text>
                  <View style={{ backgroundColor: C.gray900, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.white }}>
                      Perfil {formData.perfilProfesional} — {perfilLabel}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
          {(() => {
            const convAsigs = formData.convalidacionAsignaturas ?? [];
            type SubjectRow = { group: 1 | 2 | 3; key: string; code: string; name: string; tipo: 'matriculada' | 'perfil' | 'pendiente' };
            const rows: SubjectRow[] = [];
            if (!allPendingFromLastCourse) {
              for (const m of asignaturasCursoActual) {
                if (convAsigs.includes(m.MATERIA)) continue;
                const isPerfil = PROFILE_SPECIFIC_SUBJECTS.some(ps => m.DESCRIPCION.toLowerCase().includes(ps.toLowerCase()));
                rows.push({ group: isPerfil ? 2 : 1, key: m.MATERIA || m.DESCRIPCION, code: m.MATERIA, name: m.DESCRIPCION, tipo: isPerfil ? 'perfil' : 'matriculada' });
              }
            }
            for (const m of selectedPendingSubjects) {
              rows.push({ group: 3, key: `pending-${m.id}`, code: m.materiaId, name: m.label, tipo: 'pendiente' });
            }
            rows.sort((a, b) => a.group - b.group || a.name.localeCompare(b.name, 'es'));
            const STYLES: Record<SubjectRow['tipo'], { bg: string; border: string; code: string; codeBg: string; badge: string; badgeBg: string; badgeBorder: string; label: string }> = {
              matriculada: { bg: C.white,      border: C.blue200,   code: C.blue700,   codeBg: C.blue50,   badge: C.blue700,   badgeBg: C.blue50,   badgeBorder: C.blue200,   label: 'Matriculada' },
              perfil:      { bg: C.purple50,   border: C.purple200, code: C.purple700, codeBg: C.purple100, badge: C.purple700, badgeBg: C.purple100, badgeBorder: C.purple200, label: `Perfil ${formData.perfilProfesional || ''}`.trim() },
              pendiente:   { bg: C.orange50,   border: C.orange200, code: C.orange800, codeBg: C.orange50,  badge: C.orange800, badgeBg: C.orange50,  badgeBorder: C.orange200, label: 'Pendiente' },
            };
            const motivo = formData.convalidacionMotivo;
            const motivoLabel = motivo === 'doble' || motivo === 'eso_bach' ? CONVALIDACION_MOTIVO_LABEL[motivo] : '';
            const convalidadas = asignaturasCursoActual.filter(m => convAsigs.includes(m.MATERIA));
            return (
              <>
                {rows.length > 0 && (
                  <View style={{ backgroundColor: C.blue50, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: C.blue200, borderStyle: 'solid', marginTop: 4 }}>
                    <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.blue800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
                      Asignaturas:
                    </Text>
                    <View>
                      {rows.map((item, idx) => {
                        const st = STYLES[item.tipo];
                        const isGroupStart = idx > 0 && rows[idx - 1].group !== item.group;
                        return (
                          <View key={item.key}>
                            {isGroupStart && (
                              <View style={{ borderTopWidth: 1, borderTopColor: C.blue200, borderTopStyle: 'solid', marginVertical: 3, opacity: 0.6 }} />
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: st.bg, borderWidth: 1, borderColor: st.border, borderStyle: 'solid', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 2 }}>
                              {item.code ? (
                                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: st.code, backgroundColor: st.codeBg, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 }}>
                                  {item.code}
                                </Text>
                              ) : null}
                              <Text style={{ fontSize: 8, color: C.gray700, flex: 1 }}>{item.name}</Text>
                              <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: st.badge, backgroundColor: st.badgeBg, borderWidth: 1, borderColor: st.badgeBorder, borderStyle: 'solid', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 8 }}>
                                {st.label}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                {convalidadas.length > 0 && (
                  <View style={{ backgroundColor: C.green50, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: C.green200, borderStyle: 'solid', marginTop: 4 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.green800, marginBottom: 3 }}>SOLICITA:</Text>
                    <Text style={{ fontSize: 8, color: C.gray700, lineHeight: 1.4, marginBottom: 5 }}>
                      Que, de acuerdo con la normativa vigente en materia de ordenación académica, por razón de "{motivoLabel}", se proceda a la convalidación de las asignaturas que se detallan a continuación:
                    </Text>
                    <View>
                      {convalidadas.map(m => (
                        <View key={`conv-${m.MATERIA}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.white, borderWidth: 1, borderColor: C.green200, borderStyle: 'solid', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 2 }}>
                          <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.green700, backgroundColor: C.green100, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 }}>
                            {m.MATERIA}
                          </Text>
                          <Text style={{ fontSize: 8, color: C.gray700, flex: 1 }}>{m.DESCRIPCION}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* ── Pie de página ── */}
        <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.gray200, borderTopStyle: 'solid', flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ gap: 1.5 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray700 }}>Consejería de Educación, Cultura y Deportes</Text>
            <Text style={{ fontSize: 7, color: C.gray700 }}>Conservatorio Profesional de Música "Marcos Redondo"</Text>
            <Text style={{ fontSize: 7, color: C.gray500 }}>Calle Pantano del Vicario, 1 — 13004 Ciudad Real</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 1.5 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray700 }}>926 274 154</Text>
            <Text style={{ fontSize: 7, color: C.gray500 }}>13004341.cpm@educastillalamancha.es</Text>
            <Text style={{ fontSize: 7, color: C.gray500 }}>www.conservatoriociudadreal.es</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
};

const MatriculaPdfMemoized = React.memo(MatriculaPdfComponent);
export { MatriculaPdfMemoized as MatriculaPdf };
