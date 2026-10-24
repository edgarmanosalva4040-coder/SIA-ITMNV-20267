import { ProgramCode } from './sia-architecture-data';

export interface CourseItem {
  id: string;
  code: string;
  name: string;
  programId: ProgramCode;
  cycle: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  credits: number;
  prerequisiteCode: string | null;
  competencyUnit: string;
}

export interface TeacherItem {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  programId: ProgramCode | 'AMBAS';
  office: string;
}

export interface StudentItem {
  id: string;
  documentType: 'DNI' | 'CE';
  documentNumber: string;
  fullName: string;
  programId: ProgramCode;
  cycle: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  shift: 'DIURNO' | 'NOCTURNO';
  isSolvent: boolean;
  status: 'MATRICULADO' | 'OBSERVADO_TESORERIA' | 'POSTULANTE';
}

export const INITIAL_COURSES_DATA: CourseItem[] = [
  // ADM_EMP
  {
    id: 'crs_ae_101',
    code: 'AE-101',
    name: 'Fundamentos de Gestión Empresarial',
    programId: 'ADM_EMP',
    cycle: 'I',
    credits: 4,
    prerequisiteCode: null,
    competencyUnit: 'UC1: Administrar los procesos operativos y documentarios',
  },
  {
    id: 'crs_ae_102',
    code: 'AE-102',
    name: 'Contabilidad General Aplicada',
    programId: 'ADM_EMP',
    cycle: 'I',
    credits: 4,
    prerequisiteCode: null,
    competencyUnit: 'UC1: Administrar los procesos operativos y documentarios',
  },
  {
    id: 'crs_ae_201',
    code: 'AE-201',
    name: 'Costos y Presupuestos Empresariales',
    programId: 'ADM_EMP',
    cycle: 'II',
    credits: 4,
    prerequisiteCode: 'AE-102',
    competencyUnit: 'UC2: Gestionar recursos financieros y logísticos',
  },
  {
    id: 'crs_ae_202',
    code: 'AE-202',
    name: 'Legislación Laboral y Tributaria SUNAT',
    programId: 'ADM_EMP',
    cycle: 'II',
    credits: 3,
    prerequisiteCode: 'AE-101',
    competencyUnit: 'UC2: Gestionar recursos financieros y logísticos',
  },
  {
    id: 'crs_ae_301',
    code: 'AE-301',
    name: 'Gestión del Talento Humano y Planillas PLAME',
    programId: 'ADM_EMP',
    cycle: 'III',
    credits: 4,
    prerequisiteCode: 'AE-202',
    competencyUnit: 'UC3: Supervisar el capital humano y procesos comerciales',
  },
  {
    id: 'crs_ae_401',
    code: 'AE-401',
    name: 'Formulaciones y Evaluación de Proyectos de Inversión',
    programId: 'ADM_EMP',
    cycle: 'IV',
    credits: 5,
    prerequisiteCode: 'AE-201',
    competencyUnit: 'UC4: Formular planes estratégicos y de negocios',
  },

  // ADM_BAN
  {
    id: 'crs_bf_101',
    code: 'BF-101',
    name: 'Sistema Financiero Peruano y Regulación SBS',
    programId: 'ADM_BAN',
    cycle: 'I',
    credits: 4,
    prerequisiteCode: null,
    competencyUnit: 'UC1: Gestionar operaciones de caja y atención en agencias',
  },
  {
    id: 'crs_bf_102',
    code: 'BF-102',
    name: 'Matemática Financiera y Cálculo Actuarial',
    programId: 'ADM_BAN',
    cycle: 'I',
    credits: 4,
    prerequisiteCode: null,
    competencyUnit: 'UC1: Gestionar operaciones de caja y atención en agencias',
  },
  {
    id: 'crs_bf_201',
    code: 'BF-201',
    name: 'Operaciones Activas, Pasivas y Tarifario Bancario',
    programId: 'ADM_BAN',
    cycle: 'II',
    credits: 4,
    prerequisiteCode: 'BF-101',
    competencyUnit: 'UC2: Evaluar productos financieros y carteras de clientes',
  },
  {
    id: 'crs_bf_202',
    code: 'BF-202',
    name: 'Contabilidad de Instituciones Financieras',
    programId: 'ADM_BAN',
    cycle: 'II',
    credits: 4,
    prerequisiteCode: 'BF-102',
    competencyUnit: 'UC2: Evaluar productos financieros y carteras de clientes',
  },
  {
    id: 'crs_bf_301',
    code: 'BF-301',
    name: 'Evaluación de Créditos PYME y Riesgo Crediticio Sentinel/Infocorp',
    programId: 'ADM_BAN',
    cycle: 'III',
    credits: 5,
    prerequisiteCode: 'BF-201',
    competencyUnit: 'UC3: Analizar riesgo crediticio y recuperación de cartera',
  },
  {
    id: 'crs_bf_401',
    code: 'BF-401',
    name: 'Mercado de Capitales, Bolsa de Valores y Fintech',
    programId: 'ADM_BAN',
    cycle: 'IV',
    credits: 4,
    prerequisiteCode: 'BF-202',
    competencyUnit: 'UC4: Estructurar portafolios de inversión y tesorería bancaria',
  },
];

export const INITIAL_TEACHERS_DATA: TeacherItem[] = [
  {
    id: 'tch_01',
    name: 'Mg. Carlos Mendoza Quispe',
    title: 'Magíster en Banca y Finanzas (SBS & Microfinanzas)',
    email: 'carlos.mendoza@itmanv.edu.pe',
    phone: '984-120-493',
    programId: 'ADM_BAN',
    office: 'Departamento Académico de Banca y Seguros',
  },
  {
    id: 'tch_02',
    name: 'CPC. Rosaura Gutiérrez Vela',
    title: 'Contadora Pública Colegiada (Costos y Tributación SUNAT)',
    email: 'rosaura.gutierrez@itmanv.edu.pe',
    phone: '972-384-102',
    programId: 'ADM_EMP',
    office: 'Departamento Académico de Contabilidad y Finanzas',
  },
  {
    id: 'tch_03',
    name: 'Lic. Oscar Ortiz Regalao',
    title: 'Licenciado en Administración (Jefe de Unidad Académica)',
    email: 'oscar.ortiz@itmanv.edu.pe',
    phone: '991-840-291',
    programId: 'ADM_EMP',
    office: 'Jefatura de Unidad Académica ITMANV',
  },
  {
    id: 'tch_04',
    name: 'Dr. Roberto Salazar Chávez',
    title: 'Doctor en Economía y Mercado de Capitales',
    email: 'roberto.salazar@itmanv.edu.pe',
    phone: '965-721-830',
    programId: 'AMBAS',
    office: 'Coordinación de Proyectos y Finanzas Corporativas',
  },
  {
    id: 'tch_05',
    name: 'Lic. Emerita Vásquez Suárez',
    title: 'Licenciada en Educación (Jefe de Trámite Documentario)',
    email: 'emerita.vasquez@itmanv.edu.pe',
    phone: '954-182-930',
    programId: 'ADM_EMP',
    office: 'Oficina de Trámite Documentario y Admisión',
  },
  {
    id: 'tch_06',
    name: 'Lic. Elmer Torres Peres',
    title: 'Director General (Deontología Profesional y Gestión Pública)',
    email: 'direccion@itmanv.edu.pe',
    phone: '941-209-582',
    programId: 'AMBAS',
    office: 'Dirección General ITMANV',
  },
];

export const INITIAL_STUDENTS_DATA: StudentItem[] = [
  {
    id: 'std_seed_1',
    documentType: 'DNI',
    documentNumber: '74829103',
    fullName: 'Lucía Fernanda Rojas Huamán',
    programId: 'ADM_BAN',
    cycle: 'III',
    shift: 'DIURNO',
    isSolvent: true,
    status: 'MATRICULADO',
  },
  {
    id: 'std_seed_2',
    documentType: 'CE',
    documentNumber: '004892105',
    fullName: 'Valentina Rivas Castellanos',
    programId: 'ADM_BAN',
    cycle: 'II',
    shift: 'NOCTURNO',
    isSolvent: true,
    status: 'MATRICULADO',
  },
  {
    id: 'std_seed_3',
    documentType: 'DNI',
    documentNumber: '71904582',
    fullName: 'Diego Alejandro Paredes Quispe',
    programId: 'ADM_EMP',
    cycle: 'II',
    shift: 'DIURNO',
    isSolvent: false,
    status: 'OBSERVADO_TESORERIA',
  },
  {
    id: 'std_seed_4',
    documentType: 'DNI',
    documentNumber: '76123940',
    fullName: 'Marco Antonio Vilca Chambi',
    programId: 'ADM_EMP',
    cycle: 'I',
    shift: 'DIURNO',
    isSolvent: true,
    status: 'MATRICULADO',
  },
];

export const STORAGE_KEY_COURSES = 'itmanv_academic_courses_v1';
export const STORAGE_KEY_TEACHERS = 'itmanv_academic_teachers_v1';
export const STORAGE_KEY_STUDENTS = 'itmanv_academic_students_v1';

export function loadSavedCourses(): CourseItem[] {
  if (typeof window === 'undefined') return INITIAL_COURSES_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COURSES);
    if (!raw) return INITIAL_COURSES_DATA;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_COURSES_DATA;
  } catch {
    return INITIAL_COURSES_DATA;
  }
}

export function saveStoredCourses(courses: CourseItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(courses));
  } catch {
    // ignore
  }
}

export function loadSavedTeachers(): TeacherItem[] {
  if (typeof window === 'undefined') return INITIAL_TEACHERS_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEACHERS);
    if (!raw) return INITIAL_TEACHERS_DATA;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TEACHERS_DATA;
  } catch {
    return INITIAL_TEACHERS_DATA;
  }
}

export function saveStoredTeachers(teachers: TeacherItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_TEACHERS, JSON.stringify(teachers));
  } catch {
    // ignore
  }
}

export function loadSavedStudents(): StudentItem[] {
  if (typeof window === 'undefined') return INITIAL_STUDENTS_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDENTS);
    if (!raw) return INITIAL_STUDENTS_DATA;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_STUDENTS_DATA;
  } catch {
    return INITIAL_STUDENTS_DATA;
  }
}

export function saveStoredStudents(students: StudentItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
  } catch {
    // ignore
  }
}

