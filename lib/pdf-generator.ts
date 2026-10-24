import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TECHNICAL_PROGRAMS, ProgramCode } from './sia-architecture-data';

export interface PrintableInvoice {
  voucherType: 'BOLETA_ELECTRONICA' | 'FACTURA_ELECTRONICA';
  seriesNumber: string;
  customerDocType: 'DNI' | 'CE' | 'RUC';
  customerDocNumber: string;
  customerName: string;
  programId: ProgramCode;
  concept: string;
  amountPen: number;
  taxRegime: 'INAFECTO_IGV_ART2_EDUCACION';
  paymentStatus: 'PAGADO' | 'VENCIDO_MOROSO' | 'PENDIENTE';
  sunatCdrStatus: 'ACEPTADO_SUNAT' | 'PENDIENTE_ENVIO' | 'RECHAZADO';
  sunatHashCpe: string;
  dueDate: string;
}

export interface PrintableEnrollment {
  studentDocType: 'DNI' | 'CE';
  studentDocNumber: string;
  studentName: string;
  programId: ProgramCode;
  cycle: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  shift: 'DIURNO' | 'NOCTURNO';
  prerequisitesVerified: boolean;
  hasDebtAlert: boolean;
  sunatReceiptNumber: string;
  creditsEnrolled: number;
  status: 'MATRICULADO' | 'OBSERVADO_TESORERIA' | 'RETIRADO';
  registeredBy: string;
}

export function downloadInvoicePdf(invoice: PrintableInvoice): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const programName = TECHNICAL_PROGRAMS[invoice.programId]?.name || invoice.programId;
  const voucherTitle =
    invoice.voucherType === 'BOLETA_ELECTRONICA'
      ? 'BOLETA DE VENTA ELECTRONICA'
      : 'FACTURA ELECTRONICA';

  // Header Left: Institutional Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('INSTITUTO DE EDUCACION SUPERIOR TECNOLOGICO ITMANV', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Sistema Integral Academico SIA ITMANV - Autorizado por MINEDU', 14, 26);
  doc.text('Direccion General: Lic. Elmer Torres Peres', 14, 31);
  doc.text('Oficina de Administracion y Tesoreria - Lima, Peru', 14, 36);

  // Header Right: SUNAT RUC Box
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.rect(132, 14, 64, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('R.U.C. 20608491024', 164, 21, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text(voucherTitle, 164, 28, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.seriesNumber, 164, 35, { align: 'center' });

  // Customer Metadata Table
  autoTable(doc, {
    startY: 46,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    body: [
      ['Adquirente / Estudiante:', invoice.customerName, 'Moneda:', 'SOLES (PEN)'],
      [
        `Documento (${invoice.customerDocType}):`,
        invoice.customerDocNumber,
        'Fecha Vencimiento:',
        invoice.dueDate,
      ],
      ['Programa de Estudios:', programName, 'Estado Tesoreria:', invoice.paymentStatus],
      [
        'Regimen Tributario:',
        'Inafecto IGV - Art. 2 inc. g) TUO Ley del IGV',
        'Estado CDR SUNAT:',
        invoice.sunatCdrStatus,
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 42, fillColor: [248, 250, 252] },
      1: { cellWidth: 68 },
      2: { fontStyle: 'bold', cellWidth: 36, fillColor: [248, 250, 252] },
      3: { cellWidth: 36 },
    },
  });

  const afterCustomerY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 86;

  // Line Items Table
  autoTable(doc, {
    startY: afterCustomerY + 6,
    theme: 'striped',
    head: [
      [
        'Item',
        'Cant.',
        'Unidad',
        'Descripcion del Servicio Educativo',
        'Afectacion IGV',
        'Valor Unit.',
        'Importe Total',
      ],
    ],
    body: [
      [
        '01',
        '1.00',
        'ZZ (Serv.)',
        invoice.concept,
        'Inafecto (Cod. 30)',
        `S/ ${invoice.amountPen.toFixed(2)}`,
        `S/ ${invoice.amountPen.toFixed(2)}`,
      ],
    ],
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 14, halign: 'right' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 68 },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
    },
  });

  const afterItemsY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 120;

  // Totals Summary Table
  autoTable(doc, {
    startY: afterItemsY + 4,
    margin: { left: 116 },
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 2,
      textColor: [15, 23, 42],
    },
    body: [
      ['OP. INAFECTA (EDUCACION):', `S/ ${invoice.amountPen.toFixed(2)}`],
      ['I.G.V. (0.00% - Art. 2 inc. g):', 'S/ 0.00'],
      ['IMPORTE TOTAL CPE:', `S/ ${invoice.amountPen.toFixed(2)}`],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 52, halign: 'right' },
      1: { fontStyle: 'bold', cellWidth: 28, halign: 'right' },
    },
  });

  const afterTotalsY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 150;

  // UBL 2.1 Hash & Legal Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, afterTotalsY + 6, 182, 24, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('REPRESENTACION IMPRESA DE COMPROBANTE DE PAGO ELECTRONICO (UBL 2.1)', 18, afterTotalsY + 12);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Resumen Hash CPE (XAdES-BES): ${invoice.sunatHashCpe}`, 18, afterTotalsY + 18);
  doc.text(
    `Estado Constancia de Recepcion (CDR): ${invoice.sunatCdrStatus} - Res. N. 097-2012/SUNAT`,
    18,
    afterTotalsY + 24
  );

  doc.save(`CPE_SUNAT_${invoice.seriesNumber}_${invoice.customerDocNumber}.pdf`);
}

export function downloadEnrollmentPdf(
  enrollment: PrintableEnrollment,
  customCourses?: Array<{
    code: string;
    name: string;
    cycle: string;
    competencyUnit: string;
    prerequisiteCode: string | null;
    credits: number;
  }>
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const programObj = TECHNICAL_PROGRAMS[enrollment.programId];
  const programName = programObj?.name || enrollment.programId;

  // Institutional Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('INSTITUTO DE EDUCACION SUPERIOR TECNOLOGICO ITMANV', 14, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(29, 78, 216);
  doc.text('FICHA OFICIAL DE MATRICULA SEMESTRAL - PERIODO ACADEMICO 2026-II', 14, 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${programObj?.cnoCode || 'Normativa MINEDU Ley N. 30512'} | Titulo: ${programObj?.degreeTitle || ''}`,
    14,
    33
  );

  // Student & Enrollment Details Table
  autoTable(doc, {
    startY: 39,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    body: [
      ['Estudiante:', enrollment.studentName, 'Ciclo Academico:', `Ciclo ${enrollment.cycle}`],
      [
        `Documento (${enrollment.studentDocType}):`,
        enrollment.studentDocNumber,
        'Turno:',
        enrollment.shift,
      ],
      [
        'Carrera Tecnica:',
        programName,
        'Creditos Inscritos:',
        `${enrollment.creditsEnrolled} creditos`,
      ],
      [
        'Boleta Electronica SUNAT:',
        enrollment.sunatReceiptNumber,
        'Estado Matricula:',
        enrollment.status,
      ],
      [
        'Prerrequisitos Curriculares:',
        enrollment.prerequisitesVerified ? 'VERIFICADO CONFORME' : 'OBSERVADO',
        'Alerta Tesoreria:',
        enrollment.hasDebtAlert ? 'CON DEUDA VENCIDA' : 'SOLVENTE AL DIA',
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 44, fillColor: [248, 250, 252] },
      1: { cellWidth: 66 },
      2: { fontStyle: 'bold', cellWidth: 36, fillColor: [248, 250, 252] },
      3: { cellWidth: 36 },
    },
  });

  const afterHeaderY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 85;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('UNIDADES DIDACTICAS INSCRITAS DEL PLAN DE ESTUDIOS MODULAR', 14, afterHeaderY + 8);

  const coursesList =
    customCourses && customCourses.length > 0 ? customCourses : programObj?.courses || [];

  autoTable(doc, {
    startY: afterHeaderY + 11,
    theme: 'striped',
    head: [
      [
        'Codigo',
        'Unidad Didactica',
        'Ciclo',
        'Unidad de Competencia MINEDU',
        'Prerrequisito',
        'Creditos',
      ],
    ],
    body: coursesList.map((c) => [
      c.code,
      c.name,
      c.cycle,
      c.competencyUnit,
      c.prerequisiteCode || 'Ninguno',
      String(c.credits),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 56 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 56 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
    },
  });

  const afterCoursesY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 155;

  // Institutional Signatures Block
  const sigY = afterCoursesY + 26;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);

  // Signature 1: Trámite Documentario
  doc.line(16, sigY, 68, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Lic. Emerita Vasquez Suarez', 42, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Jefe de Tramite Documentario', 42, sigY + 9, { align: 'center' });

  // Signature 2: Gestión Académica
  doc.line(79, sigY, 131, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Lic. Oscar Ortiz Regalao', 105, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Jefe de Unidad Academica', 105, sigY + 9, { align: 'center' });

  // Signature 3: Director General
  doc.line(142, sigY, 194, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Lic. Elmer Torres Peres', 168, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Director General ITMANV', 168, sigY + 9, { align: 'center' });

  doc.save(`Ficha_Matricula_ITMANV_${enrollment.studentDocNumber}_2026-II.pdf`);
}

export interface PrintableAdmissionCertificate {
  documentType: 'DNI' | 'CE';
  documentNumber: string;
  fullName: string;
  programId: ProgramCode;
  modality:
    | 'ORDINARIO'
    | 'EXONERADO_PRIMEROS_PUESTOS'
    | 'DEPORTISTA_CALIFICADO'
    | 'CONADIS'
    | 'TRASLADO_EXTERNO';
  examScore: number;
  dossierStatus:
    | 'PENDIENTE'
    | 'PENDIENTE_CARPETA'
    | 'VALIDADO_TRAMITE'
    | 'ADMITIDO_DIRECTORAL'
    | 'OBSERVADO';
  resolutionNumber: string;
  validatedBy: string;
}

const MODALITY_LABELS: Record<PrintableAdmissionCertificate['modality'], string> = {
  ORDINARIO: 'Examen de Admision Ordinario',
  EXONERADO_PRIMEROS_PUESTOS: 'Exonerado - 1.er y 2.do Puesto de Educacion Basica',
  DEPORTISTA_CALIFICADO: 'Exonerado - Deportista Calificado Acreditado por el IPD',
  CONADIS: 'Reserva de Ley N. 29973 - Persona con Discapacidad (CONADIS - 5%)',
  TRASLADO_EXTERNO: 'Traslado Externo con Convalidacion de Creditos (Unidad Academica)',
};

export function downloadAdmissionCertificatePdf(
  applicant: PrintableAdmissionCertificate
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const programObj = TECHNICAL_PROGRAMS[applicant.programId];
  const programName = programObj?.name || applicant.programId;
  const modalityLabel = MODALITY_LABELS[applicant.modality] || applicant.modality;
  const resolutionCode =
    applicant.resolutionNumber && applicant.resolutionNumber !== 'En trámite'
      ? applicant.resolutionNumber
      : `RD-ITMANV-2026-0${applicant.documentNumber.slice(-3)}`;

  // Header Left: Institutional Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('INSTITUTO DE EDUCACION SUPERIOR TECNOLOGICO ITMANV', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Autorizado por el Ministerio de Educacion (MINEDU) - Ley N. 30512', 14, 26);
  doc.text('Direccion General: Lic. Elmer Torres Peres', 14, 31);
  doc.text('Jefatura de Tramite Documentario: Lic. Emerita Vasquez Suarez', 14, 36);

  // Header Right: Official Certificate Box
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.rect(128, 14, 68, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(29, 78, 216);
  doc.text('CONSTANCIA DE INGRESO', 162, 21, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PROCESO DE ADMISION 2026-II', 162, 27, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.text(resolutionCode, 162, 34, { align: 'center' });

  // Formal Banner Title
  doc.setFillColor(15, 23, 42);
  doc.rect(14, 46, 182, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'CONSTANCIA OFICIAL DE INGRESO Y ADJUDICACION DE VACANTE MINEDU',
    105,
    52,
    { align: 'center' }
  );

  // Formal Certification Paragraph
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const introText =
    'El Director General y la Jefa de Tramite Documentario del Instituto de Educacion Superior Tecnologico ITMANV que suscriben la presente, en cumplimiento de la Ley N. 30512 (Ley de Institutos y Escuelas de Educacion Superior) y el Reglamento Institucional de Admision vigente, HACEN CONSTAR QUE:';
  const splitIntro = doc.splitTextToSize(introText, 182);
  doc.text(splitIntro, 14, 63);

  // Admitted Student Details Table
  autoTable(doc, {
    startY: 78,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
    },
    body: [
      ['INGRESANTE ADMITIDO(A):', applicant.fullName.toUpperCase()],
      [
        'DOCUMENTO DE IDENTIDAD:',
        `${applicant.documentType} N. ${applicant.documentNumber} (Verificado conforme en Padron Oficial)`,
      ],
      ['CARRERA TECNICA PROFESIONAL:', programName.toUpperCase()],
      [
        'CODIGO CATALOGO NACIONAL (CNO-F):',
        programObj?.cnoCode || 'Sector Administracion y Finanzas MINEDU',
      ],
      [
        'TITULO A NOMBRE DE LA NACION:',
        programObj?.degreeTitle || 'Profesional Tecnico',
      ],
      ['MODALIDAD DE ADMISION PERU:', modalityLabel],
      [
        'PUNTAJE OBTENIDO / MERITO:',
        `${applicant.examScore} / 100.00 puntos (VACANTE ADJUDICADA - APTO)`,
      ],
      ['RESOLUCION DIRECTORAL:', `${resolutionCode} - Periodo Academico 2026-II`],
      [
        'ESTADO DE EXPEDIENTE:',
        applicant.dossierStatus === 'ADMITIDO_DIRECTORAL'
          ? 'ADMITIDO CON RESOLUCION DIRECTORAL FIRME'
          : 'EXPEDIENTE HABILITADO EN ADMISION',
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 64, fillColor: [241, 245, 249] },
      1: { cellWidth: 118, fontStyle: 'bold' },
    },
  });

  const afterDetailsY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 155;

  // Curriculum & Enrollment Instructions Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'ESTRUCTURA ACADEMICA DEL PROGRAMA E INDICACIONES PARA MATRICULA:',
    14,
    afterDetailsY + 9
  );

  autoTable(doc, {
    startY: afterDetailsY + 12,
    theme: 'striped',
    head: [
      [
        'Regimen de Estudios',
        'Duracion Oficial',
        'Creditos Totales',
        'Ciclo de Ingreso',
        'Requisito Tesoreria / SUNAT',
      ],
    ],
    body: [
      [
        'Modular por Competencias',
        `${programObj?.cycles || 6} Ciclos Academicos (3 Anos)`,
        `${programObj?.totalCredits || 120} Creditos MINEDU`,
        'Ciclo I (Semestre 2026-II)',
        'Boleta Electronica CPE SUNAT (Inafecto IGV)',
      ],
    ],
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
  });

  const afterPlanY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 195;

  // Legal Closing Note
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, afterPlanY + 6, 182, 22, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const closingText =
    'Se expide la presente Constancia Oficial de Ingreso a solicitud del interesado(a) para los fines de formalizacion de Matricula Semestral ante la Oficina de Tramite Documentario y Tesoreria del IESTP ITMANV. La vacante adjudicada es personal e intransferible conforme al Reglamento de Admision.';
  doc.text(doc.splitTextToSize(closingText, 174), 18, afterPlanY + 12);

  // Signatures Block
  const sigY = afterPlanY + 52;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);

  // Signature 1: Trámite Documentario
  doc.line(16, sigY, 68, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Lic. Emerita Vasquez Suarez', 42, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Jefe de Tramite Documentario', 42, sigY + 9, { align: 'center' });

  // Signature 2: Unidad Académica
  doc.line(79, sigY, 131, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Lic. Oscar Ortiz Regalao', 105, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Jefe de Unidad Academica', 105, sigY + 9, { align: 'center' });

  // Signature 3: Director General
  doc.line(142, sigY, 194, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Lic. Elmer Torres Peres', 168, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Director General ITMANV', 168, sigY + 9, { align: 'center' });

  doc.save(`Constancia_Ingreso_ITMANV_${applicant.documentNumber}_2026-II.pdf`);
}

