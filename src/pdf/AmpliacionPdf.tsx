import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import logoCpm from '../assets/pdf/logo_cpm.png';
import logoJccm from '../assets/pdf/logo_jccm.png';

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
  blue50: '#EFF6FF', blue100: '#DBEAFE', blue200: '#BFDBFE',
  blue700: '#1D4ED8', blue800: '#1E40AF', blue900: '#1E3A8A',
  orange50: '#FFF7ED', orange100: '#FFEDD5', orange200: '#FED7AA',
  orange500: '#F97316', orange600: '#EA580C', orange700: '#C2410C',
  purple50: '#FAF5FF', purple100: '#F3E8FF', purple200: '#E9D5FF',
  purple600: '#7C3AED', purple700: '#7E22CE', purple800: '#5B21B6',
};

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 20, fontSize: 9, color: C.gray900, fontFamily: 'Helvetica' },
  card: { backgroundColor: C.white, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: C.gray200, borderStyle: 'solid' },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.blue800, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.gray100, borderBottomStyle: 'solid' },
  row: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1.5 },
  fieldValue: { fontSize: 9, fontFamily: 'Helvetica', color: C.gray800, backgroundColor: C.gray50, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  fieldValueHighlight: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray900, backgroundColor: C.gray50, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4 },
  fieldValueDark: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.white, backgroundColor: C.gray900, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  boxFilled: { width: 8, height: 8, borderRadius: 2, borderWidth: 1.5, borderColor: C.gray900, borderStyle: 'solid', backgroundColor: C.gray900 },
  boxEmpty:  { width: 8, height: 8, borderRadius: 2, borderWidth: 1.5, borderColor: C.gray500, borderStyle: 'solid' },
  labelSmall: { fontSize: 7.5, color: C.gray700, fontFamily: 'Helvetica' },
  labelMicro: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.4 },
});

const Field = ({ label, value, variant }: { label: string; value: string; variant?: 'highlight' | 'dark' }) => {
  const styleValue = variant === 'highlight' ? s.fieldValueHighlight : variant === 'dark' ? s.fieldValueDark : s.fieldValue;
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={styleValue}>{value || '—'}</Text>
    </View>
  );
};

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
  const academicYearLong = mes >= 8 ? `${y} / ${y + 1}` : `${y - 1} / ${y}`;
  const academicYearShort = mes >= 8 ? `${String(y).slice(-2)}/${String(y + 1).slice(-2)}` : `${String(y - 1).slice(-2)}/${String(y).slice(-2)}`;

  const tituloAmpliacion = `AMPLIACIÓN del curso ${cursoActual} a ${nuevoCurso}${especialidad ? ` en la especialidad de ${especialidad}` : ''}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Cabecera ── */}
        <View style={{ ...s.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: 10 }}>
          {/* Izquierda: logo JCCM */}
          <View style={{ width: 90, alignItems: 'flex-start' }}>
            <Image src={logoJccm} style={{ height: 34 }} />
          </View>

          {/* Centro: títulos */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.gray900 }}>
              Ampliación de Matrícula
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
              <Text style={{ fontSize: 9, color: C.gray500 }}>Curso Académico {academicYearLong}</Text>
              <Text style={{ fontSize: 9, color: C.gray500 }}>Curso {academicYearShort}</Text>
            </View>
            <Text style={{ fontSize: 8, color: C.gray500, marginTop: 1 }}>C.P.M. "Marcos Redondo", Ciudad Real</Text>
            <View style={{ marginTop: 5, backgroundColor: C.blue800, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 0.5 }}>
                {tituloAmpliacion}
              </Text>
            </View>
          </View>

          {/* Derecha: logo CPM + nº orden + fecha */}
          <View style={{ width: 150, alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image src={logoCpm} style={{ height: 26 }} />
              {nOrden != null && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.orange500, lineHeight: 1 }}>
                    #{nOrden}
                  </Text>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.purple700, marginTop: 1 }}>
                    Curso {academicYearShort}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ marginTop: 4, backgroundColor: C.orange500, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white }}>
                Enviado: {fechaInscFmt}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Fila: Datos personales (izq) + Forma de Pago (der) ── */}
        <View style={{ flexDirection: 'row', gap: 6 }}>

          {/* Datos personales */}
          <View style={{ flex: 2.6 }}>
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
              <View style={s.row}>
                <View style={{ flex: 1.8 }}><Field label="Correo electrónico" value={email} /></View>
                <View style={{ flex: 1 }}><Field label="Teléfono" value={telefono ?? ''} /></View>
              </View>

              <View style={{ marginTop: 4, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.gray100, borderTopStyle: 'solid', flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.labelMicro}>Hora salida</Text>
                  {(['<17 h', '17 h', '18 h'] as const).map(h => (
                    <View key={h} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <View style={(horaSalida === h || (h === '<17 h' && horaSalida === 'Antes de las 17 h')) ? s.boxFilled : s.boxEmpty} />
                      <Text style={s.labelSmall}>{h}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.labelMicro}>Disponib. mañana</Text>
                  {([{ label: 'Sí', val: true }, { label: 'No', val: false }]).map(op => (
                    <View key={op.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <View style={disponibilidadManana === op.val ? s.boxFilled : s.boxEmpty} />
                      <Text style={s.labelSmall}>{op.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.labelMicro}>Autorización imagen</Text>
                  {([{ label: 'Sí', val: true }, { label: 'No', val: false }]).map(op => (
                    <View key={op.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <View style={autorizacionImagen === op.val ? s.boxFilled : s.boxEmpty} />
                      <Text style={s.labelSmall}>{op.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Forma de Pago */}
          <View style={{ flex: 1 }}>
            <View style={s.card}>
              <Text style={s.sectionTitle}>Forma de Pago</Text>
              <View style={{ gap: 5 }}>
                <Field label="Modalidad" value={formaPago ?? ''} />
                {reduccionTasas && reduccionTasas.toLowerCase() !== 'ninguna' ? (
                  <Field label="Reducción de tasas" value={reduccionTasas} />
                ) : null}
                {cuantia ? (
                  <View style={{ marginTop: 4, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.gray100, borderTopStyle: 'solid' }}>
                    <Field label="Importe Total (EUR)" value={cuantia} variant="highlight" />
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* ── Datos de Matriculación ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Datos de Matriculación</Text>
          <View style={s.row}>
            <View style={{ flex: 1.2 }}><Field label="Curso actual" value={cursoActual} /></View>
            <View style={{ flex: 1.2 }}><Field label="Nuevo curso" value={nuevoCurso} variant="dark" /></View>
            <View style={{ flex: 2 }}><Field label="Especialidad" value={especialidad ?? ''} /></View>
          </View>
        </View>

        {/* ── Asignaturas ── */}
        {asignaturas.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Asignaturas Matriculadas ({asignaturas.length})</Text>
            <View style={{ backgroundColor: C.blue50, borderRadius: 6, padding: 7, borderWidth: 1, borderColor: C.blue200, borderStyle: 'solid' }}>
              <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.blue800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
                Asignaturas:
              </Text>
              {asignaturas.map((a, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.white, borderWidth: 1, borderColor: C.blue200, borderStyle: 'solid', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 2 }}>
                  <Text style={{ flex: 1, fontSize: 9, color: C.gray700 }}>{a.nombre}</Text>
                  {a.horario ? (
                    <Text style={{ width: 110, fontSize: 7.5, color: C.gray500 }}>{a.horario}</Text>
                  ) : null}
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.blue700, backgroundColor: C.blue50, borderWidth: 1, borderColor: C.blue200, borderStyle: 'solid', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 8 }}>
                    {a.estadoLabel}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Observaciones ── */}
        {observaciones ? (
          <View style={{ ...s.card, backgroundColor: C.purple50, borderColor: C.purple200 }}>
            <Text style={{ ...s.sectionTitle, color: C.purple700, borderBottomColor: C.purple200 }}>Observaciones</Text>
            <Text style={{ fontSize: 8.5, color: C.gray700, lineHeight: 1.5 }}>{observaciones}</Text>
          </View>
        ) : null}

        {/* ── Pie de página ── */}
        <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.gray200, borderTopStyle: 'solid', flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ gap: 1.5 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.gray700 }}>Consejería de Educación, Cultura y Deportes</Text>
            <Text style={{ fontSize: 7, color: C.gray700 }}>Conservatorio Profesional de Música "Marcos Redondo"</Text>
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

export const AmpliacionPdf = React.memo(AmpliacionPdfComponent);
