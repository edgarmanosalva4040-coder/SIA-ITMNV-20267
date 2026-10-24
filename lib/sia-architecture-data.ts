export type ProgramCode = 'ADM_EMP' | 'ADM_BAN';

export type InstitutionalRole =
  | 'DIRECTOR'
  | 'TRAMITE'
  | 'ACADEMICA'
  | 'TESORERIA'
  | 'DOCENTE'
  | 'ESTUDIANTE';

export interface RoleAuthority {
  role: InstitutionalRole;
  title: string;
  officialName: string;
  office: string;
  permissionsSummary: string;
  allowedModules: string[];
}

export const INSTITUTIONAL_AUTHORITIES: RoleAuthority[] = [
  {
    role: 'DIRECTOR',
    title: 'Director General',
    officialName: 'Lic. Elmer Torres Peres',
    office: 'Dirección General — ITMANV',
    permissionsSummary:
      'Aprobación de cuadro de vacantes, emisión de Resoluciones Directorales (Exonerados, Deportistas Calificados, Traslados), visado final de Actas Oficiales MINEDU y auditoría de recaudación SUNAT.',
    allowedModules: [
      'arquitectura',
      'admision',
      'matriculas',
      'notas',
      'horarios',
      'tesoreria',
      'portales',
    ],
  },
  {
    role: 'TRAMITE',
    title: 'Jefe de Trámite Documentario y Admisión',
    officialName: 'Lic. Emerita Vásquez Suárez',
    office: 'Oficina de Secretaría Académica y Trámite Documentario',
    permissionsSummary:
      'Verificación de identidad (DNI / Carné de Extranjería), validación de carpetas de postulación según modalidad peruana, control de certificados de estudios y emisión de Fichas de Matrícula.',
    allowedModules: ['arquitectura', 'admision', 'matriculas', 'tesoreria'],
  },
  {
    role: 'ACADEMICA',
    title: 'Jefe de Unidad Académica',
    officialName: 'Lic. Oscar Ortiz Regalao',
    office: 'Jefatura de Unidad Académica — Carreras Técnicas',
    permissionsSummary:
      'Configuración del Plan de Estudios por competencias, validación de prerrequisitos, programación de horarios sin cruces (aula/docente/sección), supervisión de sílabos y cierre de actas de notas.',
    allowedModules: ['arquitectura', 'matriculas', 'notas', 'horarios', 'portales'],
  },
  {
    role: 'TESORERIA',
    title: 'Área de Tesorería y Facturación SUNAT',
    officialName: 'CPC. Área de Tesorería ITMANV',
    office: 'Oficina de Administración y Finanzas',
    permissionsSummary:
      'Control de pensiones de enseñanza, activación/levantamiento de alertas de morosidad, emisión en tiempo real de Boletas (B001) y Facturas (F001) UBL 2.1 vía OSE/SUNAT (Inafecto IGV Art. 2° inc. g).',
    allowedModules: ['arquitectura', 'tesoreria', 'matriculas'],
  },
  {
    role: 'DOCENTE',
    title: 'Portal Docente',
    officialName: 'Mg. Carlos Mendoza Quispe',
    office: 'Plana Docente — Administración y Banca',
    permissionsSummary:
      'Visualización de carga lectiva asignada, publicación de sílabos por unidad didáctica, ingreso de calificaciones vigesimales (00-20) por Indicadores de Logro (IL1, IL2, IL3) y pre-acta.',
    allowedModules: ['arquitectura', 'notas', 'horarios', 'portales'],
  },
  {
    role: 'ESTUDIANTE',
    title: 'Portal Estudiante',
    officialName: 'Est. Lucía Fernanda Rojas Huamán',
    office: 'Estudiante Regular — III Ciclo',
    permissionsSummary:
      'Matrícula en línea sujeta a cero morosidad y prerrequisitos aprobados, descarga de Ficha de Matrícula, consulta de horario sin cruces, boleta de notas y descarga de CPE XML/PDF SUNAT.',
    allowedModules: ['arquitectura', 'matriculas', 'horarios', 'tesoreria', 'portales'],
  },
];

export const TECHNICAL_PROGRAMS: Record<
  ProgramCode,
  {
    code: ProgramCode;
    name: string;
    cnoCode: string;
    totalCredits: number;
    cycles: number;
    degreeTitle: string;
    courses: {
      code: string;
      name: string;
      cycle: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
      credits: number;
      prerequisiteCode: string | null;
      competencyUnit: string;
    }[];
  }
> = {
  ADM_EMP: {
    code: 'ADM_EMP',
    name: 'Administración de Empresas',
    cnoCode: 'RVM N.° 178-2018-MINEDU — CNOF Administración',
    totalCredits: 120,
    cycles: 6,
    degreeTitle: 'Profesional Técnico en Administración de Empresas',
    courses: [
      {
        code: 'AE-101',
        name: 'Fundamentos de Gestión Empresarial',
        cycle: 'I',
        credits: 4,
        prerequisiteCode: null,
        competencyUnit: 'UC1: Administrar los procesos operativos y documentarios',
      },
      {
        code: 'AE-102',
        name: 'Contabilidad General Aplicada',
        cycle: 'I',
        credits: 4,
        prerequisiteCode: null,
        competencyUnit: 'UC1: Administrar los procesos operativos y documentarios',
      },
      {
        code: 'AE-201',
        name: 'Costos y Presupuestos Empresariales',
        cycle: 'II',
        credits: 4,
        prerequisiteCode: 'AE-102',
        competencyUnit: 'UC2: Gestionar recursos financieros y logísticos',
      },
      {
        code: 'AE-202',
        name: 'Legislación Laboral y Tributaria SUNAT',
        cycle: 'II',
        credits: 3,
        prerequisiteCode: 'AE-101',
        competencyUnit: 'UC2: Gestionar recursos financieros y logísticos',
      },
      {
        code: 'AE-301',
        name: 'Gestión del Talento Humano y Planillas PLAME',
        cycle: 'III',
        credits: 4,
        prerequisiteCode: 'AE-202',
        competencyUnit: 'UC3: Supervisar el capital humano y procesos comerciales',
      },
      {
        code: 'AE-401',
        name: 'Formulaciones y Evaluación de Proyectos de Inversión',
        cycle: 'IV',
        credits: 5,
        prerequisiteCode: 'AE-201',
        competencyUnit: 'UC4: Formular planes estratégicos y de negocios',
      },
    ],
  },
  ADM_BAN: {
    code: 'ADM_BAN',
    name: 'Administración de Negocios Bancarios y Financieros',
    cnoCode: 'RVM N.° 178-2018-MINEDU — Sector Financiero y Microfinanzas',
    totalCredits: 120,
    cycles: 6,
    degreeTitle: 'Profesional Técnico en Administración de Negocios Bancarios y Financieros',
    courses: [
      {
        code: 'BF-101',
        name: 'Sistema Financiero Peruano y Regulación SBS',
        cycle: 'I',
        credits: 4,
        prerequisiteCode: null,
        competencyUnit: 'UC1: Gestionar operaciones de caja y atención en agencias',
      },
      {
        code: 'BF-102',
        name: 'Matemática Financiera y Cálculo Actuarial',
        cycle: 'I',
        credits: 4,
        prerequisiteCode: null,
        competencyUnit: 'UC1: Gestionar operaciones de caja y atención en agencias',
      },
      {
        code: 'BF-201',
        name: 'Operaciones Activas, Pasivas y Tarifario Bancario',
        cycle: 'II',
        credits: 4,
        prerequisiteCode: 'BF-101',
        competencyUnit: 'UC2: Evaluar productos financieros y carteras de clientes',
      },
      {
        code: 'BF-202',
        name: 'Contabilidad de Instituciones Financieras',
        cycle: 'II',
        credits: 4,
        prerequisiteCode: 'BF-102',
        competencyUnit: 'UC2: Evaluar productos financieros y carteras de clientes',
      },
      {
        code: 'BF-301',
        name: 'Evaluación de Créditos PYME y Riesgo Crediticio Sentinel/Infocorp',
        cycle: 'III',
        credits: 5,
        prerequisiteCode: 'BF-201',
        competencyUnit: 'UC3: Analizar riesgo crediticio y recuperación de cartera',
      },
      {
        code: 'BF-401',
        name: 'Mercado de Capitales, Bolsa de Valores y Fintech',
        cycle: 'IV',
        credits: 4,
        prerequisiteCode: 'BF-202',
        competencyUnit: 'UC4: Estructurar portafolios de inversión y tesorería bancaria',
      },
    ],
  },
};

export interface ModuleArchitectureSpec {
  id: string;
  code: string;
  moduleName: string;
  keyFunctionalities: string[];
  involvedActors: string[];
  criticalBusinessRules: string[];
  accessPolicies: string[];
}

export const SIA_ARCHITECTURE_MATRIX: ModuleArchitectureSpec[] = [
  {
    id: 'MOD-01',
    code: 'M01 · ADMISIÓN',
    moduleName: 'Módulo de Admisión y Control de Vacantes',
    keyFunctionalities: [
      'Inscripción de postulantes para Administración de Empresas y Administración de Negocios Bancarios y Financieros.',
      'Gestión de modalidades peruanas (Ley N.° 30512): Ordinario, Exonerados (1.° y 2.° puesto Educación Básica), Deportistas Calificados (IPD), Ley N.° 29973 (CONADIS - reserva mínima 5%) y Traslado Externo.',
      'Verificación documental de identidad (DNI de 8 dígitos / Carné de Extranjería de 9 a 12 caracteres) y certificados oficiales de estudios.',
      'Generación de cuadro de mérito por puntaje (0–100 pts) y adjudicación de vacantes mediante Resolución Directoral.',
    ],
    involvedActors: [
      'Trámite Documentario: Lic. Emerita Vásquez Suárez (Validación de carpeta del postulante y documentos de exoneración).',
      'Director General: Lic. Elmer Torres Peres (Aprobación de cuadro de vacantes y firma de Resolución Directoral de Ingreso).',
      'Gestión Académica: Lic. Oscar Ortiz Regalao (Configuración de temario y ponderación de evaluación).',
    ],
    criticalBusinessRules: [
      'RN-ADM-01 (Cuota de Vacantes y Reserva Legal): No se puede adjudicar ingreso si la meta de vacantes de la carrera está cubierta. Se reserva el 5% para personas con discapacidad (Ley N.° 29973).',
      'RN-ADM-02 (Exoneración de Examen): Las modalidades Primeros Puestos, Deportista Calificado acreditado por el IPD y Traslado Externo requieren validación previa de expediente por la Lic. Emerita Vásquez Suárez y Resolución Directoral del Lic. Elmer Torres Peres.',
      'RN-ADM-03 (Pago de Derecho de Admisión): Todo expediente exige vinculación con una Boleta Electrónica SUNAT (Serie B001) en estado ACEPTADO_SUNAT.',
    ],
    accessPolicies: [
      'Escritura de expedientes y validación: Lic. Emerita Vásquez Suárez (Rol TRAMITE).',
      'Adjudicación definitiva y emisión de Resolución Directoral (Estado Terminal ADMITIDO_DIRECTORAL): Exclusivo Lic. Elmer Torres Peres (Rol DIRECTOR).',
      'Lectura de resultados: Postulante propietario y Unidad Académica.',
    ],
  },
  {
    id: 'MOD-02',
    code: 'M02 · MATRÍCULAS',
    moduleName: 'Módulo de Matrículas y Validación Curricular',
    keyFunctionalities: [
      'Generación de Ficha de Matrícula Semestral con validación de tipo de documento (DNI / Carné de Extranjería).',
      'Motor de validación automática de prerrequisitos según el Plan de Estudios Modular de cada carrera técnica.',
      'Verificación sincrónica de solvencia con Tesorería (bloqueo preventivo por deudas vencidas de ciclos anteriores) y enlace a Boleta Electrónica SUNAT.',
      'Control de límite de créditos por semestre (máximo 22 créditos regulares o hasta 26 con autorización académica).',
    ],
    involvedActors: [
      'Trámite Documentario: Lic. Emerita Vásquez Suárez (Emisión oficial y fedateo de Ficha de Matrícula).',
      'Gestión Académica: Lic. Oscar Ortiz Regalao (Autorización de matrícula por unidades didácticas de subsanación y convalidaciones).',
      'Estudiante (Automatrícula condicionada desde su portal independiente).',
    ],
    criticalBusinessRules: [
      'RN-MAT-01 (Bloqueo por Morosidad): Un estudiante con cuotas en estado VENCIDO_MOROSO en Tesorería queda impedido de confirmar matrícula hasta regularizar su estado de cuenta o contar con fraccionamiento autorizado.',
      'RN-MAT-02 (Cadena de Prerrequisitos): No se permite inscribir una Unidad Didáctica del ciclo N+1 (ej. Evaluación de Créditos PYME BF-301) si no figura aprobada (nota >= 13) la unidad prerrequisito (BF-201).',
      'RN-MAT-03 (Vinculación Tributaria SUNAT): La Ficha de Matrícula se activa únicamente tras emitirse el Comprobante de Pago Electrónico (B001/F001) por concepto de Derecho de Matrícula.',
    ],
    accessPolicies: [
      'Aprobación de excepciones curriculares: Lic. Oscar Ortiz Regalao (Rol ACADEMICA).',
      'Validación de identidad DNI/CE y emisión de Ficha Oficial: Lic. Emerita Vásquez Suárez (Rol TRAMITE).',
      'Consulta y descarga de Ficha de Matrícula: Estudiante titular (aislamiento por UID/DNI).',
    ],
  },
  {
    id: 'MOD-03',
    code: 'M03 · GESTIÓN DE NOTAS',
    moduleName: 'Módulo de Evaluación por Competencias y Actas MINEDU',
    keyFunctionalities: [
      'Registro de calificaciones en escala vigesimal (00 a 20) estructurado por Indicadores de Logro (IL1, IL2, IL3) conforme a los Lineamientos Académicos Generales (LAG) del MINEDU.',
      'Cálculo automatizado del Promedio Final y clasificación cualitativa: Logro Destacado (18-20), Logrado (13-17), En Proceso / Recuperación (10-12) y Desaprobado (00-09).',
      'Flujo de cierre de Actas Oficiales: Abierto al Docente -> Cerrado por Unidad Académica -> Visado por Dirección General.',
    ],
    involvedActors: [
      'Docente Titular de la Unidad Didáctica (Ingreso de evaluaciones por indicadores de logro).',
      'Gestión Académica: Lic. Oscar Ortiz Regalao (Auditoría de promedios, jurado de recuperación y cierre de actas).',
      'Director General: Lic. Elmer Torres Peres (Visado final e inmutabilidad del Acta Oficial MINEDU).',
    ],
    criticalBusinessRules: [
      'RN-NOT-01 (Nota Mínima Aprobatoria MINEDU): La nota mínima aprobatoria en Institutos de Educación Superior Tecnológicos del Perú es trece (13). Las fracciones >= 0.5 redondean al entero superior solo en el Promedio Final.',
      'RN-NOT-02 (Bloqueo de Estado Terminal en Firestore): Una vez que el acta alcanza el estado VISADO_DIRECTOR (firmada por el Lic. Elmer Torres Peres), las reglas de seguridad de Firestore bloquean cualquier modificación posterior.',
    ],
    accessPolicies: [
      'Ingreso de IL1, IL2, IL3 mientras actaStatus == ABIERTO_DOCENTE: Rol DOCENTE y Rol ACADEMICA.',
      'Cierre de Acta (CERRADO_ACADEMICA): Exclusivo Lic. Oscar Ortiz Regalao (Rol ACADEMICA).',
      'Visado Oficial (VISADO_DIRECTOR): Exclusivo Lic. Elmer Torres Peres (Rol DIRECTOR).',
    ],
  },
  {
    id: 'MOD-04',
    code: 'M04 · HORARIOS',
    moduleName: 'Módulo de Programación Horaria Anti-Cruces',
    keyFunctionalities: [
      'Asignación de bloques horarios por carrera (Administración de Empresas / Negocios Bancarios), ciclo (I–VI), turno (Diurno/Nocturno), aula/laboratorio y docente.',
      'Algoritmo de validación determinista anti-cruces en triple dimensión: (1) Cruce de Docente, (2) Cruce de Aula/Laboratorio Financiero, y (3) Cruce de Sección/Ciclo.',
      'Control de publicación de Sílabos vinculados a cada bloque horario.',
    ],
    involvedActors: [
      'Gestión Académica: Lic. Oscar Ortiz Regalao (Planificación y validación de horarios y carga lectiva).',
      'Docentes y Estudiantes (Consulta en tiempo real de horarios libres de colisiones).',
    ],
    criticalBusinessRules: [
      'RN-HOR-01 (Invariante de No-Intersección Horaria): Para cualquier par de bloques en el mismo día, si comparten el mismo Docente, la misma Aula o el mismo (Programa + Ciclo), el intervalo [HoraInicio, HoraFin) no puede solaparse.',
      'RN-HOR-02 (Requisito de Sílabo): Toda unidad didáctica programada debe registrar su sílabo por competencias antes del inicio de la semana 1 lectiva.',
    ],
    accessPolicies: [
      'Creación, reprogramación y asignación de aulas/docentes: Exclusivo Lic. Oscar Ortiz Regalao (Rol ACADEMICA) y Dirección General.',
      'Actualización de estado de sílabo: Rol DOCENTE y Rol ACADEMICA.',
      'Lectura de grilla horaria: Todos los usuarios autenticados del programa.',
    ],
  },
  {
    id: 'MOD-05',
    code: 'M05 · TESORERÍA',
    moduleName: 'Módulo de Tesorería, Cuentas Corrientes y Alertas de Morosidad',
    keyFunctionalities: [
      'Gestión de cronograma de pagos semestrales: Derecho de Admisión, Matrícula y 5 Cuotas de Pensión de Enseñanza.',
      'Motor de alertas tempranas y bloqueo preventivo por morosidad al superar la fecha de vencimiento.',
      'Conciliación de recaudación por carrera técnica y reporte gerencial para Dirección General.',
    ],
    involvedActors: [
      'Área de Tesorería (Control de cobranza y estados de cuenta).',
      'Director General: Lic. Elmer Torres Peres (Supervisión de indicadores de morosidad y becas/fraccionamientos).',
      'Trámite Documentario: Lic. Emerita Vásquez Suárez (Consulta de solvencia previo a entrega de certificados o fichas).',
    ],
    criticalBusinessRules: [
      'RN-TES-01 (Propagación de Alerta de Morosidad): Si una obligación pasa a estado VENCIDO_MOROSO, se activa automáticamente el indicador hasDebtAlert en el expediente del alumno, restringiendo nueva matrícula y emisión de constancias.',
      'RN-TES-02 (Trazabilidad de Pagos): Ninguna deuda puede marcarse como PAGADO sin generar simultáneamente su respectivo Comprobante de Pago Electrónico SUNAT.',
    ],
    accessPolicies: [
      'Registro de cobros y actualización de estados de deuda: Rol TESORERIA y Rol DIRECTOR.',
      'Verificación de semáforo de morosidad: Rol TRAMITE y Rol ACADEMICA.',
      'Consulta de estado de cuenta personal: Rol ESTUDIANTE.',
    ],
  },
  {
    id: 'MOD-06',
    code: 'M06 · FACTURACIÓN SUNAT',
    moduleName: 'Módulo de Facturación Electrónica SUNAT en Tiempo Real (UBL 2.1)',
    keyFunctionalities: [
      'Emisión en línea de Boletas de Venta Electrónicas (Serie B001) para personas naturales con DNI/CE y Facturas Electrónicas (Serie F001) para empresas patrocinadoras con RUC.',
      'Generación de estructura estándar UBL 2.1, firma digital XAdES-BES, cálculo de Resumen Hash CPE y envío síncrono a OSE / SUNAT Operaciones en Línea.',
      'Aplicación automática de Inafectación del IGV para servicios educativos conforme al Art. 2° inciso g) del TUO de la Ley del IGV (D.S. N.° 055-99-EF).',
      'Representación impresa con Código QR reglamentario y estado de Constancia de Recepción (CDR: ACEPTADO_SUNAT).',
    ],
    involvedActors: [
      'Área de Tesorería (Emisión y envío de comprobantes electrónicos).',
      'Trámite Documentario: Lic. Emerita Vásquez Suárez (Asociación del número de serie B001-XXXX a trámites y matrículas).',
      'Director General: Lic. Elmer Torres Peres (Fiscalización tributaria e informes contables).',
    ],
    criticalBusinessRules: [
      'RN-SUN-01 (Régimen Tributario Educativo): Los servicios de enseñanza y matrícula de los IEST están Inafectos al IGV (Código de Afectación Tributaria 30 - Inafecto Operación Onerosa, Catálogo N.° 07 SUNAT).',
      'RN-SUN-02 (Validación de Identidad Receptor): Boletas superiores a S/ 700.00 exigen obligatoriamente DNI o Carné de Extranjería; en SIA ITMANV toda boleta académica registra el DNI/CE del estudiante para trazabilidad MINEDU-SUNAT.',
      'RN-SUN-03 (Inmutabilidad del CPE): Un comprobante con CDR ACEPTADO_SUNAT no puede ser editado ni eliminado; cualquier corrección tributaria requiere Nota de Crédito Electrónica (BC01/FC01).',
    ],
    accessPolicies: [
      'Emisión de comprobantes B001/F001: Rol TESORERIA y Rol DIRECTOR.',
      'Descarga de representación impresa y XML/CDR: Estudiante receptor del comprobante y autoridades administrativas.',
    ],
  },
  {
    id: 'MOD-07',
    code: 'M07 · PORTALES INDEPENDIENTES',
    moduleName: 'Portales Independientes para Docente y Estudiante',
    keyFunctionalities: [
      'Portal Docente: Consulta de carga académica asignada por el Lic. Oscar Ortiz Regalao, repositorio de sílabos por competencias, ingreso de notas por Indicadores de Logro y asistencia.',
      'Portal Estudiante: Ficha de Matrícula validada, horario semanal libre de cruces, boleta de notas vigesimal por unidades didácticas y billetera de comprobantes electrónicos SUNAT.',
    ],
    involvedActors: [
      'Docentes de Administración de Empresas y Negocios Bancarios y Financieros.',
      'Estudiantes Regulares e Ingresantes.',
      'Gestión Académica: Lic. Oscar Ortiz Regalao (Gobernanza de accesos y periodos de carga de notas).',
    ],
    criticalBusinessRules: [
      'RN-POR-01 (Segregación de Vistas y Datos): El Portal Estudiante restringe la visibilidad de boletas de notas detalladas si el alumno mantiene alerta activa de morosidad vencida, mostrando el aviso de regularización en Tesorería.',
      'RN-POR-02 (Ventana de Carga Docente): El docente solo puede modificar calificaciones dentro del calendario académico habilitado por el Lic. Oscar Ortiz Regalao y antes del visado directoral del Lic. Elmer Torres Peres.',
    ],
    accessPolicies: [
      'Portal Docente: Acceso autenticado con rol DOCENTE únicamente a las unidades didácticas asignadas a su carga lectiva.',
      'Portal Estudiante: Acceso autenticado con rol ESTUDIANTE únicamente a sus propios registros de matrícula, notas y boletas SUNAT.',
    ],
  },
];

export const INITIAL_APPLICANTS_SEED = [
  {
    documentType: 'DNI' as const,
    documentNumber: '74829103',
    fullName: 'Lucía Fernanda Rojas Huamán',
    programId: 'ADM_BAN' as const,
    modality: 'EXONERADO_PRIMEROS_PUESTOS' as const,
    examScore: 94,
    dossierStatus: 'ADMITIDO_DIRECTORAL' as const,
    validatedBy: 'Lic. Emerita Vásquez Suárez',
    resolutionNumber: 'RD-0118-2026-DG-ITMANV',
  },
  {
    documentType: 'DNI' as const,
    documentNumber: '71904582',
    fullName: 'Diego Alejandro Paredes Quispe',
    programId: 'ADM_EMP' as const,
    modality: 'ORDINARIO' as const,
    examScore: 82,
    dossierStatus: 'VALIDADO_TRAMITE' as const,
    validatedBy: 'Lic. Emerita Vásquez Suárez',
    resolutionNumber: 'EN-TRAMITE-2026-II',
  },
  {
    documentType: 'CE' as const,
    documentNumber: '004892105',
    fullName: 'Valentina Rivas Castellanos',
    programId: 'ADM_BAN' as const,
    modality: 'DEPORTISTA_CALIFICADO' as const,
    examScore: 88,
    dossierStatus: 'ADMITIDO_DIRECTORAL' as const,
    validatedBy: 'Lic. Emerita Vásquez Suárez',
    resolutionNumber: 'RD-0124-2026-DG-ITMANV',
  },
  {
    documentType: 'DNI' as const,
    documentNumber: '76123940',
    fullName: 'Marco Antonio Vilca Chambi',
    programId: 'ADM_EMP' as const,
    modality: 'CONADIS' as const,
    examScore: 79,
    dossierStatus: 'VALIDADO_TRAMITE' as const,
    validatedBy: 'Lic. Emerita Vásquez Suárez',
    resolutionNumber: 'RD-0129-2026-DG-ITMANV',
  },
];

export const INITIAL_ENROLLMENTS_SEED = [
  {
    studentDocType: 'DNI' as const,
    studentDocNumber: '74829103',
    studentName: 'Lucía Fernanda Rojas Huamán',
    programId: 'ADM_BAN' as const,
    cycle: 'III' as const,
    shift: 'DIURNO' as const,
    prerequisitesVerified: true,
    hasDebtAlert: false,
    sunatReceiptNumber: 'B001-0004812',
    creditsEnrolled: 21,
    status: 'MATRICULADO' as const,
    registeredBy: 'Lic. Emerita Vásquez Suárez',
  },
  {
    studentDocType: 'CE' as const,
    studentDocNumber: '004892105',
    studentName: 'Valentina Rivas Castellanos',
    programId: 'ADM_BAN' as const,
    cycle: 'II' as const,
    shift: 'NOCTURNO' as const,
    prerequisitesVerified: true,
    hasDebtAlert: false,
    sunatReceiptNumber: 'B001-0004815',
    creditsEnrolled: 20,
    status: 'MATRICULADO' as const,
    registeredBy: 'Lic. Emerita Vásquez Suárez',
  },
  {
    studentDocType: 'DNI' as const,
    studentDocNumber: '71904582',
    studentName: 'Diego Alejandro Paredes Quispe',
    programId: 'ADM_EMP' as const,
    cycle: 'II' as const,
    shift: 'DIURNO' as const,
    prerequisitesVerified: true,
    hasDebtAlert: true,
    sunatReceiptNumber: 'PENDIENTE-PAGO',
    creditsEnrolled: 18,
    status: 'OBSERVADO_TESORERIA' as const,
    registeredBy: 'Lic. Oscar Ortiz Regalao',
  },
];

export const INITIAL_GRADES_SEED = [
  {
    studentDocNumber: '74829103',
    studentName: 'Lucía Fernanda Rojas Huamán',
    programId: 'ADM_BAN' as const,
    courseCode: 'BF-301',
    courseName: 'Evaluación de Créditos PYME y Riesgo Crediticio Sentinel/Infocorp',
    cycle: 'III' as const,
    il1: 17,
    il2: 18,
    il3: 19,
    finalAverage: 18,
    competencyState: 'LOGRO_DESTACADO' as const,
    actaStatus: 'VISADO_DIRECTOR' as const,
    teacherName: 'Mg. Carlos Mendoza Quispe',
  },
  {
    studentDocNumber: '004892105',
    studentName: 'Valentina Rivas Castellanos',
    programId: 'ADM_BAN' as const,
    courseCode: 'BF-201',
    courseName: 'Operaciones Activas, Pasivas y Tarifario Bancario',
    cycle: 'II' as const,
    il1: 15,
    il2: 16,
    il3: 15,
    finalAverage: 15,
    competencyState: 'LOGRADO' as const,
    actaStatus: 'CERRADO_ACADEMICA' as const,
    teacherName: 'Mg. Carlos Mendoza Quispe',
  },
  {
    studentDocNumber: '71904582',
    studentName: 'Diego Alejandro Paredes Quispe',
    programId: 'ADM_EMP' as const,
    courseCode: 'AE-201',
    courseName: 'Costos y Presupuestos Empresariales',
    cycle: 'II' as const,
    il1: 12,
    il2: 11,
    il3: 12,
    finalAverage: 12,
    competencyState: 'EN_PROCESO' as const,
    actaStatus: 'ABIERTO_DOCENTE' as const,
    teacherName: 'CPC. Rosaura Gutiérrez Vela',
  },
];

export const INITIAL_SCHEDULES_SEED = [
  {
    programId: 'ADM_BAN' as const,
    cycle: 'III' as const,
    courseCode: 'BF-301',
    courseName: 'Evaluación de Créditos PYME y Riesgo Crediticio Sentinel/Infocorp',
    teacherName: 'Mg. Carlos Mendoza Quispe',
    classroom: 'LAB-FIN-101',
    dayOfWeek: 'LUNES' as const,
    startTime: '08:00',
    endTime: '11:15',
    syllabusStatus: 'PUBLICADO' as const,
    assignedBy: 'Lic. Oscar Ortiz Regalao',
  },
  {
    programId: 'ADM_BAN' as const,
    cycle: 'II' as const,
    courseCode: 'BF-201',
    courseName: 'Operaciones Activas, Pasivas y Tarifario Bancario',
    teacherName: 'Mg. Carlos Mendoza Quispe',
    classroom: 'LAB-FIN-102',
    dayOfWeek: 'MIERCOLES' as const,
    startTime: '18:30',
    endTime: '21:45',
    syllabusStatus: 'PUBLICADO' as const,
    assignedBy: 'Lic. Oscar Ortiz Regalao',
  },
  {
    programId: 'ADM_EMP' as const,
    cycle: 'II' as const,
    courseCode: 'AE-201',
    courseName: 'Costos y Presupuestos Empresariales',
    teacherName: 'CPC. Rosaura Gutiérrez Vela',
    classroom: 'AULA-204',
    dayOfWeek: 'MARTES' as const,
    startTime: '08:00',
    endTime: '11:15',
    syllabusStatus: 'PUBLICADO' as const,
    assignedBy: 'Lic. Oscar Ortiz Regalao',
  },
  {
    programId: 'ADM_EMP' as const,
    cycle: 'III' as const,
    courseCode: 'AE-301',
    courseName: 'Gestión del Talento Humano y Planillas PLAME',
    teacherName: 'Lic. Oscar Ortiz Regalao',
    classroom: 'LAB-EMP-301',
    dayOfWeek: 'JUEVES' as const,
    startTime: '09:30',
    endTime: '12:45',
    syllabusStatus: 'PUBLICADO' as const,
    assignedBy: 'Lic. Oscar Ortiz Regalao',
  },
];

export const INITIAL_INVOICES_SEED = [
  {
    voucherType: 'BOLETA_ELECTRONICA' as const,
    seriesNumber: 'B001-0004812',
    customerDocType: 'DNI' as const,
    customerDocNumber: '74829103',
    customerName: 'Lucía Fernanda Rojas Huamán',
    programId: 'ADM_BAN' as const,
    concept: 'Derecho de Matrícula Semestral 2026-II — III Ciclo Banca y Finanzas',
    amountPen: 280.0,
    taxRegime: 'INAFECTO_IGV_ART2_EDUCACION' as const,
    paymentStatus: 'PAGADO' as const,
    sunatCdrStatus: 'ACEPTADO_SUNAT' as const,
    sunatHashCpe: 'vK9x2mQp8Lz4wR7nJ1tY6bC3fH5gD0sA9eU2iO4p=',
    dueDate: '2026-08-15',
  },
  {
    voucherType: 'BOLETA_ELECTRONICA' as const,
    seriesNumber: 'B001-0004815',
    customerDocType: 'CE' as const,
    customerDocNumber: '004892105',
    customerName: 'Valentina Rivas Castellanos',
    programId: 'ADM_BAN' as const,
    concept: 'Derecho de Matrícula Semestral 2026-II — Modalidad Deportista Calificado',
    amountPen: 140.0,
    taxRegime: 'INAFECTO_IGV_ART2_EDUCACION' as const,
    paymentStatus: 'PAGADO' as const,
    sunatCdrStatus: 'ACEPTADO_SUNAT' as const,
    sunatHashCpe: 'mN4pL8qR1zW6xC9vB2tY5hJ7kF3dS0gA8eI1uO6y=',
    dueDate: '2026-08-18',
  },
  {
    voucherType: 'BOLETA_ELECTRONICA' as const,
    seriesNumber: 'B001-0004829',
    customerDocType: 'DNI' as const,
    customerDocNumber: '71904582',
    customerName: 'Diego Alejandro Paredes Quispe',
    programId: 'ADM_EMP' as const,
    concept: 'Pensión de Enseñanza Cuota 02 — Administración de Empresas',
    amountPen: 350.0,
    taxRegime: 'INAFECTO_IGV_ART2_EDUCACION' as const,
    paymentStatus: 'VENCIDO_MOROSO' as const,
    sunatCdrStatus: 'ACEPTADO_SUNAT' as const,
    sunatHashCpe: 'pQ7rT2yU5iO8aS1dF4gH7jK0lZ3xC6vB9nM2qW5e=',
    dueDate: '2026-09-30',
  },
];
