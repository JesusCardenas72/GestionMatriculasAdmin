import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import logoCpm from '../assets/logo_cpm.png';
import logoJccm from '../assets/logo_jccm.png';

export interface AmpliacionAsignatura {
  nombre: string;
  estadoLabel: string;
  horario?: string;
}

export interface AmpliacionPdfProps {
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono?: string | null;
  fechaNacimiento?: string | null;
  domicilio?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  cp?: string | null;
  autorizacionImagen?: boolean;
  disponibilidadManana?: boolean;
  horaSalida?: string | null;
  cursoActual: string;
  nuevoCurso: string;
  especialidad?: string | null;
  fechaInscripcion: string;
  asignaturas: AmpliacionAsignatura[];
  formaPago?: string | null;
  cuantia?: string | null;
  reduccionTasas?: string | null;
  observaciones?: string;
  nOrden?: number | null;
}

const C = {
  bg: '#F5F5F5', white: '#FFFFFF',
  gray50: '#F9FAFB', gray100: '#F3F4F6', gray200: '#E5E7EB',
  gray400: '#9CA3AF', gray500: '#6B7280', gray700: '#374151',
  gray800: '#1F2937', gray900: '#111827',
  blue50: '#EFF6FF', blue200: '#BFDBFE', blue700: '#1D4ED8', blue800: '#1E40AF',
  orange50: '#FFF7ED', orange200: '#FED7AA', orange800: '#92400E',
  purple50: '#FAF5FF', purple100: '#F3E8FF', purple200: '#E9D5FF',
  purple600: '#7C3AED', purple700: '#7E22CE', purple800: '#5B21B6', purple900: '#3B0764',
  violet200: '#DDD6FE', violet500: '#8B5CF6',
};

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 20, fontSize: 9, color: C.gray900, fontFamily: 'Helvetica' },
  card: { backgroundColor: C.white, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: C.gray100, borderStyle: 'solid' },
  sectionTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.gray100, borderBottomStyle: 'solid' },
  row: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1.5 },
  fieldValue: { fontSize: 9, fontFamily: 'Helvetica', color: C.gray800, backgroundColor: C.gray50, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  fieldValueHighlight: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray800, backgroundColor: C.gray50, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  boxFilled: { width: 8, height: 8, borderRadius: 2, borderWidth: 1.5, borderColor: C.gray900, borderStyle: 'solid', backgroundColor: C.gray900 },
  boxEmpty:  { width: 8, height: 8, borderRadius: 2, borderWidth: 1.5, borderColor: C.gray500, borderStyle: 'solid' },
  labelSmall: { fontSize: 7.5, color: C.gray700, fontFamily: 'Helvetica' },
  labelMicro: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.4 },
});

const Field = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <View>
    <Text style={s.fieldLabel}>{label}</Text>
    <Text style={highlight ? s.fieldValueHighlight : s.fieldValue}>{value || '—'}</Text>
  </View>
);

const AmpliacionPdfComponent = ({
  nombre, apellidos, dni, email, telefono, fechaNacimiento,
  domicilio, localidad, provincia, cp,
  autorizacionImagen, disponibilidadManana, horaSalida,
  cursoActual, nuevoCurso, especialidad, fechaInscripcion,
  asignaturas, formaPago, cuantia, reduccionTasas, observaciones, nOrden,
}: AmpliacionPdfProps) => {

  const fechaNacFmt = fechaNacimiento
    ? new Date(fechaNacimiento + 'T12:00:00').toLocaleDateString('es-ES')
    : '';

  const fechaInscFmt = fechaInscripcion
    ? new Date(fechaInscripcion + 'T12:00:00').toLocaleDateString('es-ES')
    : '';

  const y = new Date().getFullYear();
  const mes = new Date().getMonth();
  const academicYear = mes >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={{ ...s.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: 10 }}>
          <Image src={logoJccm} style={{ height: 30 }} />

          <View style={{ alignItems: 'center', gap: 3 }}>
            {/* Etiqueta AMPLIACIÓN destacada */}
            <View style={{ backgroundColor: C.purple800, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 3 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1.5 }}>
                AMPLIACION
              </Text>
            </View>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.gray900, marginTop: 2 }}>
              Ampliacion de Matricula
            </Text>
            <Text style={{ fontSize: 9, color: C.gray500 }}>Curso Academico {academicYear}</Text>
            <Text style={{ fontSize: 8, color: C.gray400 }}>C.P.M. "Marcos Redondo", Ciudad Real</Text>

            {/* Curso: origen → nuevo */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={{ backgroundColor: C.gray100, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.gray700 }}>{cursoActual}</Text>
              </View>
              <Text style={{ fontSize: 10, color: C.purple600, fontFamily: 'Helvetica-Bold' }}>→</Text>
              <View style={{ backgroundColor: C.purple800, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.white }}>{nuevoCurso}</Text>
              </View>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image src={logoCpm} style={{ height: 30 }} />
              {nOrden != null && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.purple600, lineHeight: 1 }}>
                    #{nOrden}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ backgroundColor: C.purple800, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white }}>
                Inscripcion: {fechaInscFmt}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Fila 1: Datos Personales (izq) + Forma de Pago (der) ── */}
        <View style={{ flexDirection: 'row', gap: 6 }}>

          {/* Columna izquierda: Datos Personales */}
          <View style={{ flex: 3 }}>
            <View style={s.card}>
              <Text style={s.sectionTitle}>Datos Personales</Text>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="Nombre" value={nombre} /></View>
                <View style={{ flex: 1.4 }}><Field label="Apellidos" value={apellidos} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Field label="D.N.I. / N.I.E." value={dni} /></View>
                <View style={{ flex: 1 }}><Field label="Fecha de nac." value={fechaNacFmt} /></View>
                <View style={{ flex: 1.8 }}><Field label="Domicilio actual" value={domicilio ?? ''} /></View>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1.8 }}><Field label="Localidad" value={localidad ?? ''} /></View>
                <View style={{ flex: 1 }}><Field label="Provincia" value={provincia ?? ''} /></View>
                <View style={{ flex: 0.8 }}><Field label="C.P." value={cp ?? ''} /></View>
              </View>
              <View style={{ ...s.row, marginBottom: 0 }}>
                <View style={{ flex: 1.8 }}><Field label="Correo electronico" value={email} /></View>
                <View style={{ flex: 1 }}><Field label="Telefono" value={telefono ?? ''} /></View>
              </View>
              <View style={{ marginTop: 6, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.gray100, borderTopStyle: 'solid', flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                {horaSalida && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.labelMicro}>Hora salida</Text>
                    {(['<17 h', '17 h', '18 h'] as const).map(h => (
                      <View key={h} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <View style={(horaSalida === h || (h === '<17 h' && horaSalida === 'Antes de las 17 h')) ? s.boxFilled : s.boxEmpty} />
                        <Text style={s.labelSmall}>{h}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.labelMicro}>Disponib. manana</Text>
                  {([{ label: 'Si', val: true }, { label: 'No', val: false }]).map(op => (
                    <View key={op.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <View style={disponibilidadManana === op.val ? s.boxFilled : s.boxEmpty} />
                      <Text style={s.labelSmall}>{op.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.labelMicro}>Autorizacion imagen</Text>
                  {([{ label: 'Si', val: true }, { label: 'No', val: false }]).map(op => (
                    <View key={op.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <View style={autorizacionImagen === op.val ? s.boxFilled : s.boxEmpty} />
                      <Text style={s.labelSmall}>{op.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Columna derecha: Forma de Pago */}
          <View style={{ flex: 1.4 }}>
            <View style={s.card}>
              <Text style={s.sectionTitle}>Forma de Pago</Text>
              <View style={{ gap: 6 }}>
                {formaPago && <Field label="Modalidad" value={formaPago} />}
                {cuantia && <Field label="Importe (EUR)" value={cuantia} highlight />}
                {reduccionTasas && reduccionTasas.toLowerCase() !== 'ninguna' && (
                  <Field label="Reduccion de tasas" value={reduccionTasas} />
                )}
              </View>
              {(!formaPago && !cuantia) && (
                <Text style={{ fontSize: 8, color: C.gray400, fontStyle: 'italic' }}>Sin informacion de pago</Text>
              )}
            </View>

            {/* Datos de matriculacion (nuevo curso) */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Datos de Matriculacion</Text>
              <View style={{ gap: 5 }}>
                <Field label="Nuevo Curso" value={nuevoCurso} highlight />
                {especialidad && <Field label="Especialidad" value={especialidad} />}
              </View>
            </View>
          </View>
        </View>

        {/* ── Asignaturas ── */}
        {asignaturas.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Asignaturas Matriculadas</Text>
            <View style={{ backgroundColor: C.blue50, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: C.blue200, borderStyle: 'solid' }}>
              <View style={{ flexDirection: 'row', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.blue200, borderBottomStyle: 'solid', marginBottom: 4 }}>
                <Text style={{ flex: 1, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.blue800, textTransform: 'uppercase', letterSpacing: 0.4 }}>Asignatura</Text>
                <Text style={{ width: 120, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.blue800, textTransform: 'uppercase', letterSpacing: 0.4 }}>Horario</Text>
                <Text style={{ width: 70, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.blue800, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' }}>Estado</Text>
              </View>
              {asignaturas.map((a, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.blue200, borderStyle: 'solid', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 2 }}>
                  <Text style={{ flex: 1, fontSize: 8, color: C.gray700 }}>{a.nombre}</Text>
                  <Text style={{ width: 120, fontSize: 7.5, color: C.gray500, fontFamily: 'Helvetica' }}>{a.horario || '—'}</Text>
                  <Text style={{ width: 70, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.blue700, textAlign: 'right' }}>{a.estadoLabel}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Observaciones ── */}
        {observaciones && (
          <View style={{ ...s.card, backgroundColor: C.purple50, borderColor: C.violet200 }}>
            <Text style={{ ...s.sectionTitle, color: C.purple700, borderBottomColor: C.violet200 }}>Observaciones</Text>
            <Text style={{ fontSize: 8.5, color: C.gray700, lineHeight: 1.5 }}>{observaciones}</Text>
          </View>
        )}

        {/* ── Pie de página ── */}
        <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.gray200, borderTopStyle: 'solid', flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ gap: 1.5 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray700 }}>Consejeria de Educacion, Cultura y Deportes</Text>
            <Text style={{ fontSize: 7, color: C.gray700 }}>Conservatorio Profesional de Musica "Marcos Redondo"</Text>
            <Text style={{ fontSize: 7, color: C.gray500 }}>Calle Pantano del Vicario, 1  -  13004 Ciudad Real</Text>
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

const AmpliacionPdfMemoized = React.memo(AmpliacionPdfComponent);
export { AmpliacionPdfMemoized as AmpliacionPdf };
