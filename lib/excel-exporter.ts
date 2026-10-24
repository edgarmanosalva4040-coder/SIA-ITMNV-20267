import * as XLSX from 'xlsx';
import { TECHNICAL_PROGRAMS, ProgramCode } from './sia-architecture-data';

export interface ExportableGradeRecord {
  id: string;
  studentDocNumber: string;
  studentName: string;
  programId: ProgramCode;
  courseCode: string;
  courseName: string;
  cycle: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  il1: number;
  il2: number;
  il3: number;
  finalAverage: number;
  competencyState: 'LOGRO_DESTACADO' | 'LOGRADO' | 'EN_PROCESO' | 'DESAPROBADO';
  actaStatus: 'ABIERTO_DOCENTE' | 'CERRADO_ACADEMICA' | 'VISADO_DIRECTOR';
  teacherName: string;
}

function buildActaWorksheet(
  records: ExportableGradeRecord[],
  sheetTitle: string
): XLSX.WorkSheet {
  const totalCount = records.length;
  const approvedCount = records.filter((r) => r.finalAverage >= 13).length;
  const disapprovedCount = totalCount - approvedCount;
  const visadoCount = records.filter((r) => r.actaStatus === 'VISADO_DIRECTOR').length;

  const headerRows: (string | number)[][] = [
    ['MINISTERIO DE EDUCACION DEL PERU (MINEDU) - LINEAMIENTOS ACADEMICOS GENERALES'],
    ['INSTITUTO DE EDUCACION SUPERIOR TECNOLOGICO ITMANV (SIA ITMANV) - RUC 20608491024'],
    [sheetTitle],
    [
      'Director General: Lic. Elmer Torres Peres',
      '',
      'Jefe de Unidad Academica: Lic. Oscar Ortiz Regalao',
      '',
      'Secretaria Academica / Tramite: Lic. Emerita Vasquez Suarez',
    ],
    [
      `Periodo Lectivo: 2026-II`,
      '',
      `Nota Minima Aprobatoria MINEDU: 13 (Escala Vigesimal 00 a 20)`,
      '',
      `Fecha de Emision: ${new Date().toISOString().slice(0, 10)}`,
    ],
    [],
    [
      'N.',
      'DNI / CE',
      'Apellidos y Nombres del Estudiante',
      'Cod. Programa',
      'Programa de Estudios (Carrera Tecnica)',
      'Ciclo',
      'Cod. UD',
      'Unidad Didactica',
      'IL1 (0-20)',
      'IL2 (0-20)',
      'IL3 (0-20)',
      'Promedio Final',
      'Condicion MINEDU',
      'Nivel de Logro de Competencia',
      'Docente Responsable',
      'Estado Oficial del Acta',
    ],
  ];

  const dataRows: (string | number)[][] = records.map((rec, idx) => [
    idx + 1,
    rec.studentDocNumber,
    rec.studentName,
    rec.programId,
    TECHNICAL_PROGRAMS[rec.programId]?.name || rec.programId,
    rec.cycle,
    rec.courseCode,
    rec.courseName,
    rec.il1,
    rec.il2,
    rec.il3,
    rec.finalAverage,
    rec.finalAverage >= 13 ? 'APROBADO' : 'DESAPROBADO / RECUPERACION',
    rec.competencyState.replace(/_/g, ' '),
    rec.teacherName,
    rec.actaStatus.replace(/_/g, ' '),
  ]);

  const footerRows: (string | number)[][] = [
    [],
    ['RESUMEN ESTADISTICO DEL ACTA CONSOLIDADA MINEDU'],
    ['Total Registros Evaluados:', totalCount, 'Estudiantes Aprobados (>= 13):', approvedCount],
    [
      'En Proceso / Desaprobados (< 13):',
      disapprovedCount,
      'Actas con Visado Directoral:',
      visadoCount,
    ],
    [],
    [
      '_______________________________________',
      '',
      '_______________________________________',
      '',
      '_______________________________________',
    ],
    [
      'Lic. Elmer Torres Peres',
      '',
      'Lic. Oscar Ortiz Regalao',
      '',
      'Lic. Emerita Vasquez Suarez',
    ],
    [
      'Director General - IEST ITMANV',
      '',
      'Jefe de Unidad Academica',
      '',
      'Jefe de Tramite Documentario y Actas',
    ],
  ];

  const allRows = [...headerRows, ...dataRows, ...footerRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 34 },
    { wch: 14 },
    { wch: 44 },
    { wch: 8 },
    { wch: 10 },
    { wch: 46 },
    { wch: 11 },
    { wch: 11 },
    { wch: 11 },
    { wch: 15 },
    { wch: 24 },
    { wch: 24 },
    { wch: 28 },
    { wch: 24 },
  ];

  return ws;
}

export function exportConsolidatedGradesToExcel(records: ExportableGradeRecord[]): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Consolidado Institucional General
  const wsGeneral = buildActaWorksheet(
    records,
    'ACTA CONSOLIDADA DE EVALUACION POR COMPETENCIAS - GENERAL ITMANV 2026-II'
  );
  XLSX.utils.book_append_sheet(wb, wsGeneral, 'Acta_Consolidada_MINEDU');

  // Hoja 2: Administración de Empresas
  const admEmpRecords = records.filter((r) => r.programId === 'ADM_EMP');
  const wsEmp = buildActaWorksheet(
    admEmpRecords,
    'ACTA OFICIAL MINEDU - CARRERA TECNICA: ADMINISTRACION DE EMPRESAS'
  );
  XLSX.utils.book_append_sheet(wb, wsEmp, 'Adm_Empresas');

  // Hoja 3: Administración de Negocios Bancarios y Financieros
  const admBanRecords = records.filter((r) => r.programId === 'ADM_BAN');
  const wsBan = buildActaWorksheet(
    admBanRecords,
    'ACTA OFICIAL MINEDU - CARRERA TECNICA: NEGOCIOS BANCARIOS Y FINANCIEROS'
  );
  XLSX.utils.book_append_sheet(wb, wsBan, 'Negocios_Bancarios');

  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Acta_Consolidada_MINEDU_ITMANV_2026-II_${dateStamp}.xlsx`);
}
