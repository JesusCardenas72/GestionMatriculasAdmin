import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { AmpliacionPdf, type AmpliacionPdfProps } from './AmpliacionPdf';

export type { AmpliacionPdfProps, AmpliacionAsignatura } from './AmpliacionPdf';

/** Genera los bytes del PDF de ampliación usando @react-pdf/renderer. */
export async function buildAmpliacionPdfBytes(
  props: AmpliacionPdfProps,
): Promise<Uint8Array> {
  const blob = await pdf(React.createElement(AmpliacionPdf, props)).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/** Codifica Uint8Array a Base64 de forma segura (por chunks). */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
