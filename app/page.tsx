'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  db,
  auth,
  OperationType,
  handleFirestoreError,
  testFirestoreConnection,
  signInWithGooglePopup,
  signOutUser,
} from '@/lib/firebase';
import {
  INSTITUTIONAL_AUTHORITIES,
  TECHNICAL_PROGRAMS,
  SIA_ARCHITECTURE_MATRIX,
  INITIAL_APPLICANTS_SEED,
  INITIAL_ENROLLMENTS_SEED,
  INITIAL_GRADES_SEED,
  INITIAL_SCHEDULES_SEED,
  INITIAL_INVOICES_SEED,
  InstitutionalRole,
  ProgramCode,
} from '@/lib/sia-architecture-data';
import {
  Building2,
  FileCheck2,
  GraduationCap,
  CalendarClock,
  ReceiptText,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  LogIn,
  LogOut,
  Database,
  Plus,
  Search,
  Lock,
  Layers,
  BookOpen,
  ArrowRight,
  FileSpreadsheet,
  Printer,
  Download,
  CreditCard,
  Users,
  Edit3,
  Trash2,
  BookMarked,
  UserPlus,
} from 'lucide-react';
import {
  downloadInvoicePdf,
  downloadEnrollmentPdf,
  downloadAdmissionCertificatePdf,
} from '@/lib/pdf-generator';
import { exportConsolidatedGradesToExcel } from '@/lib/excel-exporter';
import {
  CourseItem,
  TeacherItem,
  StudentItem,
  loadSavedCourses,
  saveStoredCourses,
  loadSavedTeachers,
  saveStoredTeachers,
  loadSavedStudents,
  saveStoredStudents,
} from '@/lib/academic-catalog';

interface ApplicantDoc {
  id: string;
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
  dossierStatus: 'PENDIENTE' | 'VALIDADO_TRAMITE' | 'OBSERVADO' | 'ADMITIDO_DIRECTORAL';
  validatedBy: string;
  resolutionNumber: string;
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface EnrollmentDoc {
  id: string;
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
  ownerId: string;
}

interface GradeDoc {
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
  ownerId: string;
}

interface ScheduleDoc {
  id: string;
  programId: ProgramCode;
  cycle: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  courseCode: string;
  courseName: string;
  teacherName: string;
  classroom: string;
  dayOfWeek: 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO';
  startTime: string;
  endTime: string;
  syllabusStatus: 'PUBLICADO' | 'EN_REVISION';
  assignedBy: string;
  ownerId: string;
}

interface InvoiceDoc {
  id: string;
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
  ownerId: string;
}

type ModuleTab =
  | 'arquitectura'
  | 'admision'
  | 'matriculas'
  | 'notas'
  | 'horarios'
  | 'tesoreria'
  | 'portales'
  | 'catalogos';

function generateSafeId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function generateSunatHash(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 38; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${result}=`;
}

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function computeCompetency(avg: number): GradeDoc['competencyState'] {
  if (avg >= 18) return 'LOGRO_DESTACADO';
  if (avg >= 13) return 'LOGRADO';
  if (avg >= 10) return 'EN_PROCESO';
  return 'DESAPROBADO';
}

function evaluateScheduleCollision(
  candidate: {
    programId: ProgramCode;
    cycle: ScheduleDoc['cycle'];
    teacherName: string;
    classroom: string;
    dayOfWeek: ScheduleDoc['dayOfWeek'];
    startTime: string;
    endTime: string;
  },
  existingSlots: ScheduleDoc[]
): { hasCollision: boolean; reason: string } {
  const startMin = parseTimeToMinutes(candidate.startTime);
  const endMin = parseTimeToMinutes(candidate.endTime);
  if (endMin <= startMin) {
    return {
      hasCollision: true,
      reason: 'La hora de término debe ser posterior a la hora de inicio.',
    };
  }

  for (const slot of existingSlots) {
    if (slot.dayOfWeek !== candidate.dayOfWeek) continue;
    const slotStart = parseTimeToMinutes(slot.startTime);
    const slotEnd = parseTimeToMinutes(slot.endTime);
    const overlaps = startMin < slotEnd && endMin > slotStart;
    if (!overlaps) continue;

    if (slot.classroom.toUpperCase() === candidate.classroom.trim().toUpperCase()) {
      return {
        hasCollision: true,
        reason: `Cruce de Aula detectado: ${slot.classroom} ya está ocupada el ${slot.dayOfWeek} de ${slot.startTime} a ${slot.endTime} por ${slot.courseName}.`,
      };
    }
    if (slot.teacherName.toLowerCase() === candidate.teacherName.trim().toLowerCase()) {
      return {
        hasCollision: true,
        reason: `Cruce de Docente detectado: ${slot.teacherName} ya dicta ${slot.courseName} el ${slot.dayOfWeek} de ${slot.startTime} a ${slot.endTime}.`,
      };
    }
    if (slot.programId === candidate.programId && slot.cycle === candidate.cycle) {
      return {
        hasCollision: true,
        reason: `Cruce de Sección/Ciclo detectado: El Ciclo ${slot.cycle} de ${slot.programId} ya tiene programado ${slot.courseName} de ${slot.startTime} a ${slot.endTime}.`,
      };
    }
  }

  return { hasCollision: false, reason: 'Sin colisiones de aula, docente ni ciclo.' };
}

export default function SiaItmanvSystem() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeRole, setActiveRole] = useState<InstitutionalRole>('DIRECTOR');
  const [activeTab, setActiveTab] = useState<ModuleTab>('arquitectura');
  const [programFilter, setProgramFilter] = useState<'ALL' | ProgramCode>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Live Firestore state
  const [applicants, setApplicants] = useState<ApplicantDoc[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentDoc[]>([]);
  const [grades, setGrades] = useState<GradeDoc[]>([]);
  const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);

  // Selected voucher / enrollment / admission certificate preview modals
  const [selectedInvoicePreview, setSelectedInvoicePreview] = useState<InvoiceDoc | null>(null);
  const [selectedEnrollmentPreview, setSelectedEnrollmentPreview] =
    useState<EnrollmentDoc | null>(null);
  const [selectedApplicantCertificate, setSelectedApplicantCertificate] =
    useState<ApplicantDoc | null>(null);

  // Student Portal Online Payment Modal state
  const [studentPaymentModalInvoice, setStudentPaymentModalInvoice] =
    useState<InvoiceDoc | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'YAPE_PLIN' | 'TARJETA_VISA_MC' | 'PAGOEFECTIVO_CIP'
  >('YAPE_PLIN');
  const [paymentReference, setPaymentReference] = useState<string>('OP-SUNAT-2026-894120');
  const [processingStudentPayment, setProcessingStudentPayment] = useState<boolean>(false);

  // Dynamic Academic Catalog State (Courses, Teachers, Students)
  const [courses, setCourses] = useState<CourseItem[]>(loadSavedCourses);
  const [teachers, setTeachers] = useState<TeacherItem[]>(loadSavedTeachers);
  const [customStudents, setCustomStudents] = useState<StudentItem[]>(loadSavedStudents);
  const [catalogSubTab, setCatalogSubTab] = useState<'CURSOS' | 'DOCENTES' | 'ALUMNOS'>('CURSOS');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedTeacherForPortal, setSelectedTeacherForPortal] =
    useState<string>('Mg. Carlos Mendoza Quispe');

  // Course Modal Form State
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [courseForm, setCourseForm] = useState<Omit<CourseItem, 'id'>>({
    code: '',
    name: '',
    programId: 'ADM_EMP',
    cycle: 'I',
    credits: 4,
    prerequisiteCode: null,
    competencyUnit: 'UC1: Administrar los procesos operativos y documentarios',
  });

  // Teacher Modal Form State
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [teacherForm, setTeacherForm] = useState<Omit<TeacherItem, 'id'>>({
    name: '',
    title: 'Magíster / Especialista',
    email: '',
    phone: '',
    programId: 'AMBAS',
    office: 'Departamento Académico ITMANV',
  });

  // Student Modal Form State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [studentForm, setStudentForm] = useState<Omit<StudentItem, 'id'>>({
    documentType: 'DNI',
    documentNumber: '',
    fullName: '',
    programId: 'ADM_EMP',
    cycle: 'I',
    shift: 'DIURNO',
    isSolvent: true,
    status: 'MATRICULADO',
  });

  // Portal state
  const [portalSubView, setPortalSubView] = useState<'ESTUDIANTE' | 'DOCENTE'>('ESTUDIANTE');
  const [selectedStudentDoc, setSelectedStudentDoc] = useState<string>('74829103');

  // Form States — 1. Admisión
  const [newApplicant, setNewApplicant] = useState({
    documentType: 'DNI' as 'DNI' | 'CE',
    documentNumber: '',
    fullName: '',
    programId: 'ADM_EMP' as ProgramCode,
    modality: 'ORDINARIO' as ApplicantDoc['modality'],
    examScore: 75,
  });

  // Form States — 2. Matrículas
  const [newEnrollment, setNewEnrollment] = useState({
    studentDocType: 'DNI' as 'DNI' | 'CE',
    studentDocNumber: '',
    studentName: '',
    programId: 'ADM_BAN' as ProgramCode,
    cycle: 'II' as EnrollmentDoc['cycle'],
    shift: 'DIURNO' as EnrollmentDoc['shift'],
    prerequisitesVerified: true,
    sunatReceiptNumber: 'B001-0004890',
    creditsEnrolled: 20,
  });

  // Form States — 3. Notas
  const [newGrade, setNewGrade] = useState({
    studentDocNumber: '74829103',
    studentName: 'Lucía Fernanda Rojas Huamán',
    programId: 'ADM_BAN' as ProgramCode,
    courseCode: 'BF-202',
    cycle: 'II' as GradeDoc['cycle'],
    il1: 16,
    il2: 15,
    il3: 17,
    teacherName: 'Mg. Carlos Mendoza Quispe',
  });

  // Form States — 4. Horarios
  const [newSchedule, setNewSchedule] = useState({
    programId: 'ADM_EMP' as ProgramCode,
    cycle: 'I' as ScheduleDoc['cycle'],
    courseCode: 'AE-101',
    teacherName: 'Mg. Carlos Mendoza Quispe',
    classroom: 'LAB-FIN-101',
    dayOfWeek: 'LUNES' as ScheduleDoc['dayOfWeek'],
    startTime: '08:00',
    endTime: '11:15',
  });

  // Form States — 5. Tesorería & Facturación SUNAT
  const [newInvoice, setNewInvoice] = useState({
    voucherType: 'BOLETA_ELECTRONICA' as InvoiceDoc['voucherType'],
    customerDocType: 'DNI' as InvoiceDoc['customerDocType'],
    customerDocNumber: '',
    customerName: '',
    programId: 'ADM_BAN' as ProgramCode,
    concept: 'Pensión de Enseñanza Cuota 03 — Semestre 2026-II',
    amountPen: 350,
    paymentStatus: 'PAGADO' as InvoiceDoc['paymentStatus'],
    dueDate: '2026-11-15',
  });

  const currentAuthority = useMemo(
    () =>
      INSTITUTIONAL_AUTHORITIES.find((a) => a.role === activeRole) ||
      INSTITUTIONAL_AUTHORITIES[0],
    [activeRole]
  );

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      setAuthReady(true);
      if (currUser) {
        try {
          const userRef = doc(db, 'users', currUser.uid);
          await setDoc(
            userRef,
            {
              uid: currUser.uid,
              fullName: (currUser.displayName || 'Usuario Institucional ITMANV').slice(0, 110),
              email: (currUser.email || 'usuario@itmanv.edu.pe').slice(0, 140),
              role: activeRole,
              assignedPersonName: currentAuthority.officialName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // Ignore merge error if already exists with immutable createdAt
        }
      } else {
        setApplicants([]);
        setEnrollments([]);
        setGrades([]);
        setSchedules([]);
        setInvoices([]);
      }
    });
    return () => unsub();
  }, [activeRole, currentAuthority.officialName]);

  useEffect(() => {
    if (!authReady || !user) {
      return;
    }

    const qApplicants = query(collection(db, 'applicants'), where('ownerId', '==', user.uid));
    const unsubApplicants = onSnapshot(
      qApplicants,
      (snap) => {
        setApplicants(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApplicantDoc, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'applicants')
    );

    const qEnrollments = query(collection(db, 'enrollments'), where('ownerId', '==', user.uid));
    const unsubEnrollments = onSnapshot(
      qEnrollments,
      (snap) => {
        setEnrollments(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EnrollmentDoc, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments')
    );

    const qGrades = query(collection(db, 'grades'), where('ownerId', '==', user.uid));
    const unsubGrades = onSnapshot(
      qGrades,
      (snap) => {
        setGrades(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GradeDoc, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'grades')
    );

    const qSchedules = query(collection(db, 'schedules'), where('ownerId', '==', user.uid));
    const unsubSchedules = onSnapshot(
      qSchedules,
      (snap) => {
        setSchedules(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduleDoc, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
    );

    const qInvoices = query(collection(db, 'invoices'), where('ownerId', '==', user.uid));
    const unsubInvoices = onSnapshot(
      qInvoices,
      (snap) => {
        setInvoices(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvoiceDoc, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')
    );

    return () => {
      unsubApplicants();
      unsubEnrollments();
      unsubGrades();
      unsubSchedules();
      unsubInvoices();
    };
  }, [authReady, user]);

  const notify = (type: 'success' | 'warning' | 'error', message: string) => {
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  };

  const handleSeedDatabase = async () => {
    if (!user) {
      notify('warning', 'Inicia sesión con tu cuenta de Google para poblar Cloud Firestore.');
      return;
    }
    setSeeding(true);
    const uidTag = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8) || 'usr';
    let currentPath = 'applicants';
    try {
      const existingAppDocs = new Set(applicants.map((a) => a.documentNumber));
      for (const item of INITIAL_APPLICANTS_SEED) {
        if (existingAppDocs.has(item.documentNumber)) continue;
        const id = `app_${uidTag}_${item.documentNumber}`;
        currentPath = `applicants/${id}`;
        await setDoc(doc(db, 'applicants', id), {
          ...item,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const existingEnrDocs = new Set(enrollments.map((e) => e.studentDocNumber));
      for (const item of INITIAL_ENROLLMENTS_SEED) {
        if (existingEnrDocs.has(item.studentDocNumber)) continue;
        const id = `mat_${uidTag}_${item.studentDocNumber}`;
        currentPath = `enrollments/${id}`;
        await setDoc(doc(db, 'enrollments', id), {
          ...item,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const existingGradeKeys = new Set(
        grades.map((g) => `${g.studentDocNumber}_${g.courseCode}`)
      );
      for (const item of INITIAL_GRADES_SEED) {
        if (existingGradeKeys.has(`${item.studentDocNumber}_${item.courseCode}`)) continue;
        const id = `grd_${uidTag}_${item.studentDocNumber}_${item.courseCode.replace('-', '')}`;
        currentPath = `grades/${id}`;
        await setDoc(doc(db, 'grades', id), {
          ...item,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const existingScheduleKeys = new Set(
        schedules.map((s) => `${s.courseCode}_${s.dayOfWeek}`)
      );
      for (const item of INITIAL_SCHEDULES_SEED) {
        if (existingScheduleKeys.has(`${item.courseCode}_${item.dayOfWeek}`)) continue;
        const id = `sch_${uidTag}_${item.courseCode.replace('-', '')}_${item.dayOfWeek}`;
        currentPath = `schedules/${id}`;
        await setDoc(doc(db, 'schedules', id), {
          ...item,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const existingInvoiceSeries = new Set(invoices.map((i) => i.seriesNumber));
      for (const item of INITIAL_INVOICES_SEED) {
        if (existingInvoiceSeries.has(item.seriesNumber)) continue;
        const id = `cpe_${uidTag}_${item.seriesNumber.replace('-', '_')}`;
        currentPath = `invoices/${id}`;
        await setDoc(doc(db, 'invoices', id), {
          ...item,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      notify(
        'success',
        'Base de datos Cloud Firestore sincronizada con expedientes de Admisión, Matrículas, Actas MINEDU, Horarios y Comprobantes SUNAT del Instituto ITMANV.'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, currentPath);
    } finally {
      setSeeding(false);
    }
  };

  // --- BUSINESS LOGIC 1: ADMISIÓN ---
  const handleCreateApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanDoc = newApplicant.documentNumber.trim();
    if (newApplicant.documentType === 'DNI' && !/^\d{8}$/.test(cleanDoc)) {
      notify('error', 'Regla RENIEC: El DNI peruano debe contener exactamente 8 dígitos numéricos.');
      return;
    }
    if (newApplicant.documentType === 'CE' && !/^[0-9A-Za-z\-]{9,12}$/.test(cleanDoc)) {
      notify(
        'error',
        'Regla Migraciones: El Carné de Extranjería debe tener entre 9 y 12 caracteres.'
      );
      return;
    }
    if (newApplicant.fullName.trim().length < 3) {
      notify('error', 'Ingresa los apellidos y nombres completos del postulante.');
      return;
    }

    const id = generateSafeId('app');
    try {
      await setDoc(doc(db, 'applicants', id), {
        documentType: newApplicant.documentType,
        documentNumber: cleanDoc,
        fullName: newApplicant.fullName.trim().slice(0, 120),
        programId: newApplicant.programId,
        modality: newApplicant.modality,
        examScore: Number(newApplicant.examScore),
        dossierStatus: 'PENDIENTE',
        validatedBy: 'Lic. Emerita Vásquez Suárez',
        resolutionNumber: 'PENDIENTE-RD',
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewApplicant({ ...newApplicant, documentNumber: '', fullName: '' });
      notify(
        'success',
        `Postulante registrado en modalidad ${newApplicant.modality}. Pendiente de validación por Trámite Documentario (Lic. Emerita Vásquez Suárez).`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `applicants/${id}`);
    }
  };

  const handleAdvanceApplicantState = async (
    applicant: ApplicantDoc,
    targetStatus: ApplicantDoc['dossierStatus']
  ) => {
    if (!user) return;
    if (applicant.dossierStatus === 'ADMITIDO_DIRECTORAL') {
      notify(
        'warning',
        'Estado Terminal: Este postulante ya cuenta con Resolución Directoral firme y su registro es inmutable.'
      );
      return;
    }
    const resolutionNumber =
      targetStatus === 'ADMITIDO_DIRECTORAL'
        ? `RD-0${130 + applicants.length}-${applicant.documentNumber.slice(-3)}-2026-DG`
        : applicant.resolutionNumber;
    const validatedBy =
      targetStatus === 'ADMITIDO_DIRECTORAL'
        ? 'Lic. Elmer Torres Peres'
        : 'Lic. Emerita Vásquez Suárez';

    try {
      await updateDoc(doc(db, 'applicants', applicant.id), {
        dossierStatus: targetStatus,
        validatedBy,
        resolutionNumber,
        examScore: applicant.examScore,
        updatedAt: serverTimestamp(),
      });
      notify(
        'success',
        targetStatus === 'ADMITIDO_DIRECTORAL'
          ? `Adjudicación de vacante aprobada mediante ${resolutionNumber} por el Director Lic. Elmer Torres Peres.`
          : `Expediente actualizado a ${targetStatus} por Trámite Documentario (Lic. Emerita Vásquez Suárez).`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `applicants/${applicant.id}`);
    }
  };

  // --- BUSINESS LOGIC 2: MATRÍCULAS (CON VALIDACIÓN DE MOROSIDAD Y PRERREQUISITOS) ---
  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanDoc = newEnrollment.studentDocNumber.trim();
    if (!/^[0-9A-Za-z\-]{8,12}$/.test(cleanDoc)) {
      notify('error', 'Número de DNI (8 dígitos) o CE (9-12 caracteres) inválido.');
      return;
    }

    // Regla Crítica 1: Verificar en Tesorería si tiene deuda VENCIDO_MOROSO
    const hasOverdueDebt = invoices.some(
      (inv) =>
        inv.customerDocNumber === cleanDoc && inv.paymentStatus === 'VENCIDO_MOROSO'
    );

    // Regla Crítica 2: Prerrequisitos para ciclos II a VI
    if (newEnrollment.cycle !== 'I' && !newEnrollment.prerequisitesVerified) {
      notify(
        'error',
        'Regla Curricular (Lic. Oscar Ortiz Regalao): No se puede matricular en ciclos superiores sin haber aprobado las Unidades Didácticas prerrequisito.'
      );
      return;
    }

    const computedStatus: EnrollmentDoc['status'] = hasOverdueDebt
      ? 'OBSERVADO_TESORERIA'
      : 'MATRICULADO';

    const id = generateSafeId('mat');
    try {
      await setDoc(doc(db, 'enrollments', id), {
        studentDocType: newEnrollment.studentDocType,
        studentDocNumber: cleanDoc,
        studentName: newEnrollment.studentName.trim().slice(0, 120),
        programId: newEnrollment.programId,
        cycle: newEnrollment.cycle,
        shift: newEnrollment.shift,
        prerequisitesVerified: newEnrollment.prerequisitesVerified,
        hasDebtAlert: hasOverdueDebt,
        sunatReceiptNumber: newEnrollment.sunatReceiptNumber.trim().slice(0, 30),
        creditsEnrolled: Number(newEnrollment.creditsEnrolled),
        status: computedStatus,
        registeredBy: currentAuthority.officialName,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewEnrollment({ ...newEnrollment, studentDocNumber: '', studentName: '' });
      if (hasOverdueDebt) {
        notify(
          'warning',
          `Alerta de Morosidad Detectada: El DNI/CE ${cleanDoc} registra deuda vencida en Tesorería. La ficha quedó en estado OBSERVADO_TESORERIA hasta regularizar su pago SUNAT.`
        );
      } else {
        notify(
          'success',
          `Ficha de Matrícula generada exitosamente y vinculada al CPE ${newEnrollment.sunatReceiptNumber}.`
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `enrollments/${id}`);
    }
  };

  // --- BUSINESS LOGIC 3: GESTIÓN DE NOTAS POR COMPETENCIAS ---
  const handleCreateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const il1 = Math.min(20, Math.max(0, Number(newGrade.il1)));
    const il2 = Math.min(20, Math.max(0, Number(newGrade.il2)));
    const il3 = Math.min(20, Math.max(0, Number(newGrade.il3)));
    const finalAverage = Math.round((il1 + il2 + il3) / 3);
    const competencyState = computeCompetency(finalAverage);

    const courseObj = courses.find((c) => c.code === newGrade.courseCode);
    const courseName = courseObj ? courseObj.name : 'Unidad Didáctica Modular';

    const id = generateSafeId('grd');
    try {
      await setDoc(doc(db, 'grades', id), {
        studentDocNumber: newGrade.studentDocNumber.trim(),
        studentName: newGrade.studentName.trim().slice(0, 120),
        programId: newGrade.programId,
        courseCode: newGrade.courseCode,
        courseName,
        cycle: newGrade.cycle,
        il1,
        il2,
        il3,
        finalAverage,
        competencyState,
        actaStatus: 'ABIERTO_DOCENTE',
        teacherName: newGrade.teacherName.trim().slice(0, 100),
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify(
        'success',
        `Evaluación por competencias registrada: Promedio Final ${finalAverage} (${competencyState}).`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `grades/${id}`);
    }
  };

  const handleAdvanceActaStatus = async (
    grade: GradeDoc,
    nextActaStatus: GradeDoc['actaStatus']
  ) => {
    if (!user) return;
    if (grade.actaStatus === 'VISADO_DIRECTOR') {
      notify(
        'warning',
        'Acta Oficial Inmutable: El Acta ya fue visada por el Director Lic. Elmer Torres Peres y está protegida por las reglas de seguridad de Firestore.'
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'grades', grade.id), {
        il1: grade.il1,
        il2: grade.il2,
        il3: grade.il3,
        finalAverage: grade.finalAverage,
        competencyState: grade.competencyState,
        actaStatus: nextActaStatus,
        updatedAt: serverTimestamp(),
      });
      notify(
        'success',
        nextActaStatus === 'VISADO_DIRECTOR'
          ? 'Acta Oficial MINEDU visada por el Director General Lic. Elmer Torres Peres (Estado bloqueado).'
          : 'Acta cerrada académicamente por el Lic. Oscar Ortiz Regalao.'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `grades/${grade.id}`);
    }
  };

  // --- BUSINESS LOGIC 4: HORARIOS CON MOTOR ANTI-CRUCES ---
  const scheduleCollisionAnalysis = evaluateScheduleCollision(newSchedule, schedules);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (scheduleCollisionAnalysis.hasCollision) {
      notify('error', scheduleCollisionAnalysis.reason);
      return;
    }

    const courseObj = courses.find((c) => c.code === newSchedule.courseCode);
    const courseName = courseObj ? courseObj.name : 'Unidad Didáctica';

    const id = generateSafeId('sch');
    try {
      await setDoc(doc(db, 'schedules', id), {
        programId: newSchedule.programId,
        cycle: newSchedule.cycle,
        courseCode: newSchedule.courseCode,
        courseName,
        teacherName: newSchedule.teacherName.trim().slice(0, 100),
        classroom: newSchedule.classroom.trim().toUpperCase().slice(0, 30),
        dayOfWeek: newSchedule.dayOfWeek,
        startTime: newSchedule.startTime,
        endTime: newSchedule.endTime,
        syllabusStatus: 'PUBLICADO',
        assignedBy: 'Lic. Oscar Ortiz Regalao',
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify(
        'success',
        `Bloque horario asignado sin cruces por Unidad Académica (Lic. Oscar Ortiz Regalao).`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `schedules/${id}`);
    }
  };

  // --- BUSINESS LOGIC 5: TESORERÍA Y FACTURACIÓN ELECTRÓNICA SUNAT ---
  const handleEmitSunatInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanDoc = newInvoice.customerDocNumber.trim();
    if (!/^[0-9A-Za-z\-]{8,12}$/.test(cleanDoc)) {
      notify('error', 'Ingresa un número de DNI (8 dígitos), CE o RUC (11 dígitos) válido.');
      return;
    }
    const prefix = newInvoice.voucherType === 'BOLETA_ELECTRONICA' ? 'B001' : 'F001';
    const nextCorrelative = String(4830 + invoices.length).padStart(7, '0');
    const seriesNumber = `${prefix}-${nextCorrelative}`;
    const sunatHashCpe = generateSunatHash();

    const id = generateSafeId('cpe');
    try {
      await setDoc(doc(db, 'invoices', id), {
        voucherType: newInvoice.voucherType,
        seriesNumber,
        customerDocType: newInvoice.customerDocType,
        customerDocNumber: cleanDoc,
        customerName: newInvoice.customerName.trim().slice(0, 120),
        programId: newInvoice.programId,
        concept: newInvoice.concept.trim().slice(0, 140),
        amountPen: Number(newInvoice.amountPen),
        taxRegime: 'INAFECTO_IGV_ART2_EDUCACION',
        paymentStatus: newInvoice.paymentStatus,
        sunatCdrStatus: 'ACEPTADO_SUNAT',
        sunatHashCpe,
        dueDate: newInvoice.dueDate,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewInvoice({ ...newInvoice, customerDocNumber: '', customerName: '' });
      notify(
        'success',
        `Comprobante Electrónico ${seriesNumber} firmado digitalmente y ACEPTADO por SUNAT (Hash: ${sunatHashCpe.slice(0, 14)}...).`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `invoices/${id}`);
    }
  };

  const handleToggleInvoicePaymentStatus = async (inv: InvoiceDoc) => {
    if (!user) return;
    const nextStatus: InvoiceDoc['paymentStatus'] =
      inv.paymentStatus === 'PAGADO' ? 'VENCIDO_MOROSO' : 'PAGADO';
    try {
      await updateDoc(doc(db, 'invoices', inv.id), {
        paymentStatus: nextStatus,
        sunatCdrStatus: 'ACEPTADO_SUNAT',
        sunatHashCpe: inv.sunatHashCpe,
        updatedAt: serverTimestamp(),
      });

      // Sincronizar alerta de morosidad en la matrícula del estudiante si existe
      const matchingEnrollments = enrollments.filter(
        (enr) => enr.studentDocNumber === inv.customerDocNumber
      );
      for (const enr of matchingEnrollments) {
        const isMoroso = nextStatus === 'VENCIDO_MOROSO';
        await updateDoc(doc(db, 'enrollments', enr.id), {
          hasDebtAlert: isMoroso,
          status: isMoroso ? 'OBSERVADO_TESORERIA' : 'MATRICULADO',
          prerequisitesVerified: enr.prerequisitesVerified,
          sunatReceiptNumber: isMoroso ? enr.sunatReceiptNumber : inv.seriesNumber,
          updatedAt: serverTimestamp(),
        });
      }

      notify(
        nextStatus === 'PAGADO' ? 'success' : 'warning',
        nextStatus === 'PAGADO'
          ? `Deuda liquidada con Boleta SUNAT ${inv.seriesNumber}. Se levantó el bloqueo académico del estudiante.`
          : `Alerta de Morosidad activada para DNI/CE ${inv.customerDocNumber}. Se bloqueó preventivamente la Ficha de Matrícula y Boleta de Notas.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${inv.id}`);
    }
  };

  const handleOpenStudentPaymentModal = (inv: InvoiceDoc) => {
    setPaymentMethod('YAPE_PLIN');
    setPaymentReference(`OP-SUNAT-${inv.seriesNumber.replace(/[^0-9A-Z]/g, '')}`);
    setStudentPaymentModalInvoice(inv);
  };

  const handleConfirmStudentOnlinePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentPaymentModalInvoice) return;
    setProcessingStudentPayment(true);

    const targetInvoice = studentPaymentModalInvoice;
    const updatedHash = targetInvoice.sunatHashCpe || generateSunatHash();

    try {
      // Actualizar estado local inmediatamente para respuesta en tiempo real
      setInvoices((prev) =>
        prev.map((item) =>
          item.id === targetInvoice.id
            ? {
                ...item,
                paymentStatus: 'PAGADO',
                sunatCdrStatus: 'ACEPTADO_SUNAT',
                sunatHashCpe: updatedHash,
              }
            : item
        )
      );

      setEnrollments((prev) =>
        prev.map((enr) =>
          enr.studentDocNumber === targetInvoice.customerDocNumber
            ? {
                ...enr,
                hasDebtAlert: false,
                status: 'MATRICULADO',
                sunatReceiptNumber: targetInvoice.seriesNumber,
              }
            : enr
        )
      );

      // Si hay sesión activa en Firebase, persistir en Cloud Firestore
      if (user) {
        await updateDoc(doc(db, 'invoices', targetInvoice.id), {
          paymentStatus: 'PAGADO',
          sunatCdrStatus: 'ACEPTADO_SUNAT',
          sunatHashCpe: updatedHash,
          updatedAt: serverTimestamp(),
        });

        const matchingEnrollments = enrollments.filter(
          (enr) => enr.studentDocNumber === targetInvoice.customerDocNumber
        );
        for (const enr of matchingEnrollments) {
          await updateDoc(doc(db, 'enrollments', enr.id), {
            hasDebtAlert: false,
            status: 'MATRICULADO',
            prerequisitesVerified: enr.prerequisitesVerified,
            sunatReceiptNumber: targetInvoice.seriesNumber,
            updatedAt: serverTimestamp(),
          });
        }
      }

      setStudentPaymentModalInvoice(null);
      notify(
        'success',
        `Pago procesado (${paymentReference}): Comprobante SUNAT ${targetInvoice.seriesNumber} actualizado a PAGADO. Se eliminó automáticamente la restricción de morosidad.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${targetInvoice.id}`);
    } finally {
      setProcessingStudentPayment(false);
    }
  };

  const handleDeleteRecord = async (collectionName: string, id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      notify('success', 'Registro eliminado de Cloud Firestore.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  // --- BUSINESS LOGIC 6: GESTIÓN DE CATÁLOGOS DINÁMICOS (CURSOS, DOCENTES, ALUMNOS) ---
  const allStudentsDirectory: StudentItem[] = useMemo(() => {
    const map = new Map<string, StudentItem>();

    // 1. Cargar estudiantes base y personalizados guardados en localStorage
    customStudents.forEach((s) => map.set(s.documentNumber, s));

    // 2. Incorporar postulantes de Admisión que no estén aún en el padrón
    applicants.forEach((app) => {
      const existing = map.get(app.documentNumber);
      if (!existing) {
        map.set(app.documentNumber, {
          id: app.id,
          documentType: app.documentType,
          documentNumber: app.documentNumber,
          fullName: app.fullName,
          programId: app.programId,
          cycle: 'I',
          shift: 'DIURNO',
          isSolvent: true,
          status: 'POSTULANTE',
        });
      }
    });

    // 3. Sincronizar reactivamente con el estado en tiempo real de Matrículas y Tesorería
    enrollments.forEach((enr) => {
      const hasMorosidad =
        enr.hasDebtAlert ||
        invoices.some(
          (i) =>
            i.customerDocNumber === enr.studentDocNumber && i.paymentStatus === 'VENCIDO_MOROSO'
        );
      const prev = map.get(enr.studentDocNumber);
      map.set(enr.studentDocNumber, {
        id: prev?.id || enr.id,
        documentType: enr.studentDocType,
        documentNumber: enr.studentDocNumber,
        fullName: enr.studentName,
        programId: enr.programId,
        cycle: enr.cycle,
        shift: enr.shift,
        isSolvent: !hasMorosidad,
        status: hasMorosidad ? 'OBSERVADO_TESORERIA' : 'MATRICULADO',
      });
    });

    return Array.from(map.values());
  }, [customStudents, enrollments, applicants, invoices]);

  // Manejo de Cursos (Unidades Didácticas)
  const handleOpenNewCourseModal = () => {
    setEditingCourse(null);
    setCourseForm({
      code: '',
      name: '',
      programId: 'ADM_EMP',
      cycle: 'I',
      credits: 4,
      prerequisiteCode: null,
      competencyUnit: 'UC1: Administrar los procesos operativos y documentarios',
    });
    setIsCourseModalOpen(true);
  };

  const handleOpenEditCourseModal = (c: CourseItem) => {
    setEditingCourse(c);
    setCourseForm({
      code: c.code,
      name: c.name,
      programId: c.programId,
      cycle: c.cycle,
      credits: c.credits,
      prerequisiteCode: c.prerequisiteCode,
      competencyUnit: c.competencyUnit,
    });
    setIsCourseModalOpen(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = courseForm.code.trim().toUpperCase();
    const cleanName = courseForm.name.trim();
    if (!cleanCode || !cleanName) {
      notify('error', 'El código y nombre de la unidad didáctica son obligatorios.');
      return;
    }

    if (editingCourse) {
      const oldCode = editingCourse.code;
      const updated = courses.map((c) =>
        c.id === editingCourse.id
          ? {
              ...c,
              code: cleanCode,
              name: cleanName,
              programId: courseForm.programId,
              cycle: courseForm.cycle,
              credits: Number(courseForm.credits),
              prerequisiteCode: courseForm.prerequisiteCode
                ? courseForm.prerequisiteCode.trim().toUpperCase()
                : null,
              competencyUnit: courseForm.competencyUnit.trim(),
            }
          : c
      );
      setCourses(updated);
      saveStoredCourses(updated);

      // Sincronización en cascada: actualizar Calificaciones y Horarios que usen este curso
      setGrades((prev) =>
        prev.map((g) =>
          g.courseCode === oldCode
            ? {
                ...g,
                courseCode: cleanCode,
                courseName: cleanName,
                programId: courseForm.programId,
                cycle: courseForm.cycle,
              }
            : g
        )
      );
      setSchedules((prev) =>
        prev.map((s) =>
          s.courseCode === oldCode
            ? {
                ...s,
                courseCode: cleanCode,
                courseName: cleanName,
                programId: courseForm.programId,
                cycle: courseForm.cycle,
              }
            : s
        )
      );

      // Si los formularios activos tenían asignado el código previo, actualizar
      if (newGrade.courseCode === oldCode) {
        setNewGrade((prev) => ({
          ...prev,
          courseCode: cleanCode,
          programId: courseForm.programId,
          cycle: courseForm.cycle,
        }));
      }
      if (newSchedule.courseCode === oldCode) {
        setNewSchedule((prev) => ({
          ...prev,
          courseCode: cleanCode,
          programId: courseForm.programId,
          cycle: courseForm.cycle,
        }));
      }

      // Si hay usuario en Firebase, persistir cambios en Firestore
      if (user) {
        const matchingGrades = grades.filter((g) => g.courseCode === oldCode);
        for (const g of matchingGrades) {
          updateDoc(doc(db, 'grades', g.id), {
            courseCode: cleanCode,
            courseName: cleanName,
            programId: courseForm.programId,
            cycle: courseForm.cycle,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
        const matchingSchedules = schedules.filter((s) => s.courseCode === oldCode);
        for (const s of matchingSchedules) {
          updateDoc(doc(db, 'schedules', s.id), {
            courseCode: cleanCode,
            courseName: cleanName,
            programId: courseForm.programId,
            cycle: courseForm.cycle,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }

      notify(
        'success',
        `Unidad Didáctica ${cleanCode} — "${cleanName}" actualizada y sincronizada en Matrículas, Notas, Horarios y Portales.`
      );
    } else {
      if (courses.some((c) => c.code.toUpperCase() === cleanCode)) {
        notify('error', `Ya existe una unidad didáctica con el código ${cleanCode}.`);
        return;
      }
      const newCrs: CourseItem = {
        id: generateSafeId('crs'),
        code: cleanCode,
        name: cleanName,
        programId: courseForm.programId,
        cycle: courseForm.cycle,
        credits: Number(courseForm.credits),
        prerequisiteCode: courseForm.prerequisiteCode
          ? courseForm.prerequisiteCode.trim().toUpperCase()
          : null,
        competencyUnit: courseForm.competencyUnit.trim(),
      };
      const updated = [newCrs, ...courses];
      setCourses(updated);
      saveStoredCourses(updated);

      // Sincronizar opciones predeterminadas de los módulos dependientes
      if (newGrade.programId === courseForm.programId) {
        setNewGrade((prev) => ({ ...prev, courseCode: cleanCode, cycle: courseForm.cycle }));
      }
      if (newSchedule.programId === courseForm.programId) {
        setNewSchedule((prev) => ({ ...prev, courseCode: cleanCode, cycle: courseForm.cycle }));
      }

      notify(
        'success',
        `Nueva Unidad Didáctica ${cleanCode} agregada y disponible de inmediato en Matrículas, Horarios y Calificaciones.`
      );
    }
    setIsCourseModalOpen(false);
  };

  const handleDeleteCourse = (courseId: string) => {
    const courseToDelete = courses.find((c) => c.id === courseId);
    const updated = courses.filter((c) => c.id !== courseId);
    setCourses(updated);
    saveStoredCourses(updated);

    if (courseToDelete) {
      // Retirar también de las selecciones de formulario si coincidían
      const remainingForProgram = updated.filter((c) => c.programId === courseToDelete.programId);
      if (newGrade.courseCode === courseToDelete.code && remainingForProgram.length > 0) {
        setNewGrade((prev) => ({
          ...prev,
          courseCode: remainingForProgram[0].code,
          cycle: remainingForProgram[0].cycle,
        }));
      }
      if (newSchedule.courseCode === courseToDelete.code && remainingForProgram.length > 0) {
        setNewSchedule((prev) => ({
          ...prev,
          courseCode: remainingForProgram[0].code,
          cycle: remainingForProgram[0].cycle,
        }));
      }
    }

    notify('success', 'Unidad didáctica eliminada del catálogo y actualizada en todos los módulos.');
  };

  // Manejo de Profesores (Docentes)
  const handleOpenNewTeacherModal = () => {
    setEditingTeacher(null);
    setTeacherForm({
      name: '',
      title: 'Magíster / Especialista',
      email: '',
      phone: '',
      programId: 'AMBAS',
      office: 'Departamento Académico ITMANV',
    });
    setIsTeacherModalOpen(true);
  };

  const handleOpenEditTeacherModal = (t: TeacherItem) => {
    setEditingTeacher(t);
    setTeacherForm({
      name: t.name,
      title: t.title,
      email: t.email,
      phone: t.phone,
      programId: t.programId,
      office: t.office,
    });
    setIsTeacherModalOpen(true);
  };

  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = teacherForm.name.trim();
    if (!cleanName) {
      notify('error', 'El nombre completo del profesor es obligatorio.');
      return;
    }

    if (editingTeacher) {
      const oldName = editingTeacher.name;
      const updated = teachers.map((t) =>
        t.id === editingTeacher.id
          ? {
              ...t,
              name: cleanName,
              title: teacherForm.title.trim(),
              email: teacherForm.email.trim(),
              phone: teacherForm.phone.trim(),
              programId: teacherForm.programId,
              office: teacherForm.office.trim(),
            }
          : t
      );
      setTeachers(updated);
      saveStoredTeachers(updated);

      // Sincronización en cascada: actualizar Horarios, Calificaciones y Portales
      setGrades((prev) =>
        prev.map((g) => (g.teacherName === oldName ? { ...g, teacherName: cleanName } : g))
      );
      setSchedules((prev) =>
        prev.map((s) => (s.teacherName === oldName ? { ...s, teacherName: cleanName } : s))
      );

      if (selectedTeacherForPortal === oldName) {
        setSelectedTeacherForPortal(cleanName);
      }
      if (newGrade.teacherName === oldName) {
        setNewGrade((prev) => ({ ...prev, teacherName: cleanName }));
      }
      if (newSchedule.teacherName === oldName) {
        setNewSchedule((prev) => ({ ...prev, teacherName: cleanName }));
      }

      if (user) {
        const matchingGrades = grades.filter((g) => g.teacherName === oldName);
        for (const g of matchingGrades) {
          updateDoc(doc(db, 'grades', g.id), {
            teacherName: cleanName,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
        const matchingSchedules = schedules.filter((s) => s.teacherName === oldName);
        for (const s of matchingSchedules) {
          updateDoc(doc(db, 'schedules', s.id), {
            teacherName: cleanName,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }

      notify(
        'success',
        `Docente ${cleanName} actualizado y sincronizado en Horarios, Calificaciones y Portal Docente.`
      );
    } else {
      const newTch: TeacherItem = {
        id: generateSafeId('tch'),
        name: cleanName,
        title: teacherForm.title.trim(),
        email: teacherForm.email.trim(),
        phone: teacherForm.phone.trim(),
        programId: teacherForm.programId,
        office: teacherForm.office.trim(),
      };
      const updated = [...teachers, newTch];
      setTeachers(updated);
      saveStoredTeachers(updated);

      // Preseleccionar en los módulos dependientes para uso inmediato
      setSelectedTeacherForPortal(cleanName);
      setNewGrade((prev) => ({ ...prev, teacherName: cleanName }));
      setNewSchedule((prev) => ({ ...prev, teacherName: cleanName }));

      notify(
        'success',
        `Docente ${cleanName} incorporado a la Plana Docente ITMANV y disponible en Horarios y Notas.`
      );
    }
    setIsTeacherModalOpen(false);
  };

  const handleDeleteTeacher = (teacherId: string) => {
    const teacherToDelete = teachers.find((t) => t.id === teacherId);
    const updated = teachers.filter((t) => t.id !== teacherId);
    setTeachers(updated);
    saveStoredTeachers(updated);

    if (teacherToDelete && selectedTeacherForPortal === teacherToDelete.name && updated.length > 0) {
      setSelectedTeacherForPortal(updated[0].name);
    }

    notify('success', 'Docente retirado de la Plana Docente y actualizado en todos los módulos.');
  };

  // Manejo de Alumnos (Padrón Estudiantil)
  const handleOpenNewStudentModal = () => {
    setEditingStudent(null);
    setStudentForm({
      documentType: 'DNI',
      documentNumber: '',
      fullName: '',
      programId: 'ADM_EMP',
      cycle: 'I',
      shift: 'DIURNO',
      isSolvent: true,
      status: 'MATRICULADO',
    });
    setIsStudentModalOpen(true);
  };

  const handleOpenEditStudentModal = (s: StudentItem) => {
    setEditingStudent(s);
    setStudentForm({
      documentType: s.documentType,
      documentNumber: s.documentNumber,
      fullName: s.fullName,
      programId: s.programId,
      cycle: s.cycle,
      shift: s.shift,
      isSolvent: s.isSolvent,
      status: s.status,
    });
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDoc = studentForm.documentNumber.trim();
    const cleanName = studentForm.fullName.trim();
    if (!/^[0-9A-Za-z-]{8,12}$/.test(cleanDoc)) {
      notify(
        'error',
        'El documento debe tener entre 8 y 12 caracteres (DNI peruano o Carné de Extranjería).'
      );
      return;
    }
    if (!cleanName) {
      notify('error', 'Los apellidos y nombres completos son obligatorios.');
      return;
    }

    if (editingStudent) {
      const oldDoc = editingStudent.documentNumber;

      // 1. Actualizar customStudents persistente
      const updatedCustom = customStudents.map((s) =>
        s.documentNumber === oldDoc
          ? {
              ...s,
              documentType: studentForm.documentType,
              documentNumber: cleanDoc,
              fullName: cleanName,
              programId: studentForm.programId,
              cycle: studentForm.cycle,
              shift: studentForm.shift,
              isSolvent: studentForm.isSolvent,
              status: studentForm.isSolvent
                ? ('MATRICULADO' as const)
                : ('OBSERVADO_TESORERIA' as const),
            }
          : s
      );
      setCustomStudents(updatedCustom);
      saveStoredStudents(updatedCustom);

      // 2. Sincronizar en cascada en Matrículas (enrollments)
      setEnrollments((prev) =>
        prev.map((enr) =>
          enr.studentDocNumber === oldDoc
            ? {
                ...enr,
                studentDocType: studentForm.documentType,
                studentDocNumber: cleanDoc,
                studentName: cleanName,
                programId: studentForm.programId,
                cycle: studentForm.cycle,
                shift: studentForm.shift,
                hasDebtAlert: !studentForm.isSolvent,
                status: studentForm.isSolvent ? 'MATRICULADO' : 'OBSERVADO_TESORERIA',
              }
            : enr
        )
      );

      // 3. Sincronizar en Admisión (applicants)
      setApplicants((prev) =>
        prev.map((app) =>
          app.documentNumber === oldDoc
            ? {
                ...app,
                documentType: studentForm.documentType,
                documentNumber: cleanDoc,
                fullName: cleanName,
                programId: studentForm.programId,
              }
            : app
        )
      );

      // 4. Sincronizar en Calificaciones (grades)
      setGrades((prev) =>
        prev.map((g) =>
          g.studentDocNumber === oldDoc
            ? {
                ...g,
                studentDocNumber: cleanDoc,
                studentName: cleanName,
                programId: studentForm.programId,
              }
            : g
        )
      );

      // 5. Sincronizar en Comprobantes SUNAT (invoices)
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.customerDocNumber === oldDoc
            ? {
                ...inv,
                customerDocType: studentForm.documentType,
                customerDocNumber: cleanDoc,
                customerName: cleanName,
                programId: studentForm.programId,
                paymentStatus: studentForm.isSolvent ? 'PAGADO' : 'VENCIDO_MOROSO',
              }
            : inv
        )
      );

      // 6. Sincronizar formularios y vistas activas
      if (selectedStudentDoc === oldDoc) {
        setSelectedStudentDoc(cleanDoc);
      }
      if (newGrade.studentDocNumber === oldDoc) {
        setNewGrade((prev) => ({
          ...prev,
          studentDocNumber: cleanDoc,
          studentName: cleanName,
          programId: studentForm.programId,
        }));
      }
      if (newEnrollment.studentDocNumber === oldDoc) {
        setNewEnrollment((prev) => ({
          ...prev,
          studentDocNumber: cleanDoc,
          studentName: cleanName,
          studentDocType: studentForm.documentType,
          programId: studentForm.programId,
        }));
      }

      // 7. Persistir en Cloud Firestore si está conectado
      if (user) {
        try {
          const matchingEnr = enrollments.filter((enr) => enr.studentDocNumber === oldDoc);
          for (const enr of matchingEnr) {
            await updateDoc(doc(db, 'enrollments', enr.id), {
              studentDocType: studentForm.documentType,
              studentDocNumber: cleanDoc,
              studentName: cleanName,
              programId: studentForm.programId,
              cycle: studentForm.cycle,
              shift: studentForm.shift,
              hasDebtAlert: !studentForm.isSolvent,
              status: studentForm.isSolvent ? 'MATRICULADO' : 'OBSERVADO_TESORERIA',
              updatedAt: serverTimestamp(),
            });
          }
          const matchingApp = applicants.filter((a) => a.documentNumber === oldDoc);
          for (const a of matchingApp) {
            await updateDoc(doc(db, 'applicants', a.id), {
              documentType: studentForm.documentType,
              documentNumber: cleanDoc,
              fullName: cleanName,
              programId: studentForm.programId,
              updatedAt: serverTimestamp(),
            });
          }
          const matchingGrd = grades.filter((g) => g.studentDocNumber === oldDoc);
          for (const g of matchingGrd) {
            await updateDoc(doc(db, 'grades', g.id), {
              studentDocNumber: cleanDoc,
              studentName: cleanName,
              programId: studentForm.programId,
              updatedAt: serverTimestamp(),
            });
          }
          const matchingInv = invoices.filter((i) => i.customerDocNumber === oldDoc);
          for (const inv of matchingInv) {
            await updateDoc(doc(db, 'invoices', inv.id), {
              customerDocType: studentForm.documentType,
              customerDocNumber: cleanDoc,
              customerName: cleanName,
              programId: studentForm.programId,
              paymentStatus: studentForm.isSolvent ? 'PAGADO' : 'VENCIDO_MOROSO',
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // ignore
        }
      }

      notify(
        'success',
        `Estudiante ${cleanName} actualizado y sincronizado en Matrículas, Notas, Tesorería y Portal Estudiantil.`
      );
    } else {
      // 1. Guardar en customStudents
      const newStudentItem: StudentItem = {
        id: generateSafeId('std'),
        documentType: studentForm.documentType,
        documentNumber: cleanDoc,
        fullName: cleanName,
        programId: studentForm.programId,
        cycle: studentForm.cycle,
        shift: studentForm.shift,
        isSolvent: studentForm.isSolvent,
        status: studentForm.isSolvent ? 'MATRICULADO' : 'OBSERVADO_TESORERIA',
      };
      const updatedCustom = [
        newStudentItem,
        ...customStudents.filter((s) => s.documentNumber !== cleanDoc),
      ];
      setCustomStudents(updatedCustom);
      saveStoredStudents(updatedCustom);

      // 2. Crear Ficha de Matrícula automática para que aparezca en el Módulo de Matrículas
      const newEnrId = generateSafeId('mat');
      const receiptSeries = `B001-000${String(4890 + enrollments.length + 1).padStart(4, '0')}`;
      const newEnr: EnrollmentDoc = {
        id: newEnrId,
        studentDocType: studentForm.documentType,
        studentDocNumber: cleanDoc,
        studentName: cleanName,
        programId: studentForm.programId,
        cycle: studentForm.cycle,
        shift: studentForm.shift,
        prerequisitesVerified: true,
        hasDebtAlert: !studentForm.isSolvent,
        sunatReceiptNumber: receiptSeries,
        creditsEnrolled: 20,
        status: studentForm.isSolvent ? 'MATRICULADO' : 'OBSERVADO_TESORERIA',
        registeredBy: currentAuthority.officialName,
        ownerId: user?.uid || 'offline',
      };
      setEnrollments((prev) => [newEnr, ...prev]);

      // 3. Crear Comprobante Electrónico en Tesorería coherente con su solvencia
      const newInvId = generateSafeId('cpe');
      const newInv: InvoiceDoc = {
        id: newInvId,
        voucherType: 'BOLETA_ELECTRONICA',
        seriesNumber: receiptSeries,
        customerDocType: studentForm.documentType,
        customerDocNumber: cleanDoc,
        customerName: cleanName,
        programId: studentForm.programId,
        concept: `Pensión de Enseñanza Cuota 01 — Semestre 2026-II (${TECHNICAL_PROGRAMS[studentForm.programId]?.name || studentForm.programId})`,
        amountPen: 350.0,
        taxRegime: 'INAFECTO_IGV_ART2_EDUCACION',
        paymentStatus: studentForm.isSolvent ? 'PAGADO' : 'VENCIDO_MOROSO',
        sunatCdrStatus: 'ACEPTADO_SUNAT',
        sunatHashCpe: generateSunatHash(),
        dueDate: '2026-09-30',
        ownerId: user?.uid || 'offline',
      };
      setInvoices((prev) => [newInv, ...prev]);

      // 4. Seleccionar de inmediato al nuevo estudiante en el Portal del Estudiante
      setSelectedStudentDoc(cleanDoc);
      setNewGrade((prev) => ({
        ...prev,
        studentDocNumber: cleanDoc,
        studentName: cleanName,
        programId: studentForm.programId,
        cycle: studentForm.cycle,
      }));
      setNewEnrollment((prev) => ({
        ...prev,
        studentDocNumber: cleanDoc,
        studentName: cleanName,
        studentDocType: studentForm.documentType,
        programId: studentForm.programId,
        cycle: studentForm.cycle,
        shift: studentForm.shift,
      }));

      // 5. Persistir en Firestore si hay sesión activa
      if (user) {
        try {
          await setDoc(doc(db, 'enrollments', newEnrId), {
            ...newEnr,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'invoices', newInvId), {
            ...newInv,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `enrollments/${newEnrId}`);
        }
      }

      notify(
        'success',
        `Estudiante ${cleanName} incorporado al padrón. Se generó su Ficha de Matrícula y cuenta corriente SUNAT, disponible en todos los módulos.`
      );
    }
    setIsStudentModalOpen(false);
  };

  const handleDeleteStudent = async (docNumber: string) => {
    // 1. Quitar de customStudents
    const updatedCustom = customStudents.filter((s) => s.documentNumber !== docNumber);
    setCustomStudents(updatedCustom);
    saveStoredStudents(updatedCustom);

    // 2. Quitar de Matrículas y Admisión
    const enrToDelete = enrollments.filter((e) => e.studentDocNumber === docNumber);
    setEnrollments((prev) => prev.filter((e) => e.studentDocNumber !== docNumber));
    const appToDelete = applicants.filter((a) => a.documentNumber === docNumber);
    setApplicants((prev) => prev.filter((a) => a.documentNumber !== docNumber));
    setInvoices((prev) => prev.filter((i) => i.customerDocNumber !== docNumber));
    setGrades((prev) => prev.filter((g) => g.studentDocNumber !== docNumber));

    // 3. Reasignar selección en Portal Estudiante si era el seleccionado
    if (selectedStudentDoc === docNumber) {
      const remaining = allStudentsDirectory.filter((s) => s.documentNumber !== docNumber);
      if (remaining.length > 0) {
        setSelectedStudentDoc(remaining[0].documentNumber);
      }
    }

    if (user) {
      try {
        for (const e of enrToDelete) {
          await deleteDoc(doc(db, 'enrollments', e.id));
        }
        for (const a of appToDelete) {
          await deleteDoc(doc(db, 'applicants', a.id));
        }
      } catch {
        // ignore
      }
    }
    notify('success', `Estudiante con documento ${docNumber} retirado del padrón y de todos los módulos.`);
  };

  // Filtered collections
  const filteredApplicants = useMemo(
    () =>
      applicants.filter(
        (a) =>
          (programFilter === 'ALL' || a.programId === programFilter) &&
          (searchQuery === '' ||
            a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.documentNumber.includes(searchQuery))
      ),
    [applicants, programFilter, searchQuery]
  );

  const filteredEnrollments = useMemo(
    () =>
      enrollments.filter(
        (e) =>
          (programFilter === 'ALL' || e.programId === programFilter) &&
          (searchQuery === '' ||
            e.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.studentDocNumber.includes(searchQuery))
      ),
    [enrollments, programFilter, searchQuery]
  );

  const filteredGrades = useMemo(
    () =>
      grades.filter(
        (g) =>
          (programFilter === 'ALL' || g.programId === programFilter) &&
          (searchQuery === '' ||
            g.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.studentDocNumber.includes(searchQuery))
      ),
    [grades, programFilter, searchQuery]
  );

  const filteredSchedules = useMemo(
    () =>
      schedules.filter(
        (s) =>
          (programFilter === 'ALL' || s.programId === programFilter) &&
          (searchQuery === '' ||
            s.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.classroom.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [schedules, programFilter, searchQuery]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (programFilter === 'ALL' || i.programId === programFilter) &&
          (searchQuery === '' ||
            i.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.seriesNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.customerDocNumber.includes(searchQuery))
      ),
    [invoices, programFilter, searchQuery]
  );

  // KPI Metrics
  const totalRevenuePen = useMemo(
    () =>
      invoices
        .filter((i) => i.paymentStatus === 'PAGADO')
        .reduce((acc, curr) => acc + curr.amountPen, 0),
    [invoices]
  );
  const morososCount = useMemo(
    () => invoices.filter((i) => i.paymentStatus === 'VENCIDO_MOROSO').length,
    [invoices]
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* SIDEBAR NAVIGATION (264px fixed on desktop) */}
      <aside className="w-full lg:w-64 bg-slate-900 text-slate-100 shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="p-5">
          {/* Brand Header */}
          <div className="pb-5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-display font-bold text-sm">
                IT
              </div>
              <div>
                <h1 className="font-display font-bold text-base tracking-tight text-white">
                  SIA ITMANV
                </h1>
                <p className="text-xs text-slate-400">IEST Privado ITMANV · Perú</p>
              </div>
            </div>
          </div>

          {/* Role / Actor Selector */}
          <div className="mt-5 pb-5 border-b border-slate-800">
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Autoridad / Portal Activo (RBAC)
            </label>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as InstitutionalRole)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {INSTITUTIONAL_AUTHORITIES.map((authItem) => (
                <option key={authItem.role} value={authItem.role}>
                  {authItem.title} — {authItem.officialName}
                </option>
              ))}
            </select>
            <div className="mt-2.5 text-xs text-slate-300 leading-relaxed">
              <p className="font-medium text-white">{currentAuthority.officialName}</p>
              <p className="text-slate-400 mt-0.5">{currentAuthority.office}</p>
            </div>
          </div>

          {/* Module Navigation */}
          <nav className="mt-5 space-y-1">
            <button
              onClick={() => setActiveTab('arquitectura')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'arquitectura'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>01. Arquitectura & Matriz SIA</span>
            </button>

            <button
              onClick={() => setActiveTab('admision')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'admision'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>02. Admisión y Modalidades</span>
            </button>

            <button
              onClick={() => setActiveTab('matriculas')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'matriculas'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileCheck2 className="w-4 h-4 shrink-0" />
              <span>03. Matrículas y Fichas DNI/CE</span>
            </button>

            <button
              onClick={() => setActiveTab('notas')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'notas'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>04. Notas por Competencias</span>
            </button>

            <button
              onClick={() => setActiveTab('horarios')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'horarios'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span>05. Horarios Anti-Cruces</span>
            </button>

            <button
              onClick={() => setActiveTab('tesoreria')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'tesoreria'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ReceiptText className="w-4 h-4 shrink-0" />
              <span>06. Tesorería y Boletas SUNAT</span>
            </button>

            <button
              onClick={() => setActiveTab('portales')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'portales'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>07. Portales Docente / Alumno</span>
            </button>

            <button
              onClick={() => setActiveTab('catalogos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'catalogos'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BookMarked className="w-4 h-4 shrink-0" />
              <span>08. Catálogos y Entidades</span>
            </button>
          </nav>
        </div>

        {/* Institutional Authorities Summary Footer */}
        <div className="p-5 border-t border-slate-800 text-xs text-slate-400 space-y-2">
          <p className="font-medium text-slate-200">Autoridades Acreditadas</p>
          <p>Dir.: Lic. Elmer Torres Peres</p>
          <p>Trámite: Lic. Emerita Vásquez Suárez</p>
          <p>Acad.: Lic. Oscar Ortiz Regalao</p>
        </div>
      </aside>

      {/* MAIN WORKSPACE CANVAS */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP BAR CONTRACT: 3 Zones (Breadcrumb / Program Links / Primary Action) */}
        <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200">
          <div className="text-sm font-medium text-slate-800 whitespace-nowrap shrink-0">
            SIA ITMANV / Semestre 2026-II / {currentAuthority.title}
          </div>

          <nav className="hidden xl:flex items-center gap-6 text-xs font-medium text-slate-600">
            <button
              onClick={() => setProgramFilter('ALL')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                programFilter === 'ALL' ? 'text-blue-700 underline underline-offset-4' : ''
              }`}
            >
              Todas las Carreras
            </button>
            <button
              onClick={() => setProgramFilter('ADM_EMP')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                programFilter === 'ADM_EMP' ? 'text-blue-700 underline underline-offset-4' : ''
              }`}
            >
              Administración de Empresas
            </button>
            <button
              onClick={() => setProgramFilter('ADM_BAN')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                programFilter === 'ADM_BAN' ? 'text-blue-700 underline underline-offset-4' : ''
              }`}
            >
              Negocios Bancarios y Financieros
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <>
                <button
                  onClick={handleSeedDatabase}
                  disabled={seeding}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{seeding ? 'Sincronizando...' : 'Cargar Datos Base ITMANV'}</span>
                </button>
                <button
                  onClick={() => signOutUser()}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => signInWithGooglePopup()}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Autenticar en Cloud Firestore</span>
              </button>
            )}
          </div>
        </header>

        {/* NOTIFICATION BANNER */}
        {feedbackBanner && (
          <div
            className={`px-6 py-3 border-b text-xs font-medium flex items-center justify-between ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : feedbackBanner.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              )}
              <span>{feedbackBanner.message}</span>
            </div>
            <button
              onClick={() => setFeedbackBanner(null)}
              className="text-xs underline ml-4 shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* AUTHENTICATION PROMPT BAR IF NOT SIGNED IN */}
        {!user && authReady && (
          <div className="px-6 py-3.5 bg-blue-50 border-b border-blue-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-blue-950">
              <span className="font-semibold">Conexión Cloud Firestore Lista:</span> Para ejecutar
              operaciones de escritura real (registrar postulantes, emitir boletas electrónicas
              SUNAT, visar actas con reglas Zero-Trust), inicia sesión con tu cuenta de Google.
            </div>
            <button
              onClick={() => signInWithGooglePopup()}
              className="px-3.5 py-1.5 text-xs font-medium bg-blue-700 text-white rounded hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              Conectar Cuenta Institucional
            </button>
          </div>
        )}

        {/* EXECUTIVE KPI STRIP */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b border-slate-200 bg-white">
          <div className="p-5 border-b sm:border-b-0 sm:border-r border-slate-200">
            <p className="text-xs text-slate-500">Postulantes en Admisión 2026-II</p>
            <p className="text-2xl font-display font-bold text-slate-900 mt-1 tabular-nums">
              {applicants.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ordinario · Exonerados · IPD · CONADIS
            </p>
          </div>

          <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-200">
            <p className="text-xs text-slate-500">Matrículas Activas y Prerrequisitos</p>
            <p className="text-2xl font-display font-bold text-slate-900 mt-1 tabular-nums">
              {enrollments.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              DNI (8 dígitos) · Carné de Extranjería
            </p>
          </div>

          <div className="p-5 border-b sm:border-b-0 sm:border-r border-slate-200">
            <p className="text-xs text-slate-500">Recaudación Facturación SUNAT (UBL 2.1)</p>
            <p className="text-2xl font-display font-bold text-emerald-700 mt-1 font-mono tabular-nums">
              S/ {totalRevenuePen.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Inafecto IGV Art. 2° inc. g · CDR Aceptado
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs text-slate-500">Alertas de Morosidad en Tesorería</p>
            <p
              className={`text-2xl font-display font-bold mt-1 tabular-nums ${
                morososCount > 0 ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {morososCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Bloqueo sincrónico de Ficha y Notas
            </p>
          </div>
        </section>

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto space-y-8">
          {/* =====================================================================
              TAB 01: ARQUITECTURA DE SOFTWARE, DIAGRAMA DE BLOQUES Y MATRIZ SIA
             ===================================================================== */}
          {activeTab === 'arquitectura' && (
            <div className="space-y-8">
              {/* Header */}
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-medium text-blue-700">
                      Especificación de Arquitectura de Software — Normativa MINEDU Ley N.° 30512 &
                      SUNAT
                    </p>
                    <h2 className="text-2xl font-display font-bold text-slate-900 mt-1">
                      Sistema Integral Académico del Instituto ITMANV (SIA ITMANV)
                    </h2>
                    <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                      Diseño arquitectónico modular para las carreras profesionales técnicas de{' '}
                      <span className="font-semibold text-slate-900">
                        Administración de Empresas
                      </span>{' '}
                      y{' '}
                      <span className="font-semibold text-slate-900">
                        Administración de Negocios Bancarios y Financieros
                      </span>
                      , con persistencia transaccional en Cloud Firestore.
                    </p>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1 shrink-0 bg-slate-50 p-3.5 rounded border border-slate-200">
                    <p className="font-semibold text-slate-900">Gobernanza Institucional:</p>
                    <p>Director: Lic. Elmer Torres Peres</p>
                    <p>Trámite Doc.: Lic. Emerita Vásquez Suárez</p>
                    <p>Unidad Académica: Lic. Oscar Ortiz Regalao</p>
                  </div>
                </div>

                {/* DIAGRAMA DE BLOQUES ARQUITECTÓNICO */}
                <div className="mt-6">
                  <h3 className="text-base font-display font-semibold text-slate-900 mb-4">
                    01. Diagrama de Bloques de la Arquitectura Multicapa (SIA ITMANV)
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Capa 1 */}
                    <div className="border border-slate-200 rounded-md p-4 bg-slate-50/60 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-mono text-blue-700 font-semibold">
                          CAPA 01 · PRESENTACIÓN Y PORTALES
                        </p>
                        <h4 className="text-sm font-display font-bold text-slate-900 mt-1">
                          Portales Segregados por Rol (RBAC)
                        </h4>
                        <ul className="mt-3 space-y-2 text-xs text-slate-700">
                          <li>
                            <span className="font-semibold text-slate-900">Dirección General:</span>{' '}
                            Lic. Elmer Torres Peres (Resoluciones Directorales y Visado de Actas).
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">
                              Trámite Documentario:
                            </span>{' '}
                            Lic. Emerita Vásquez Suárez (Carpetas DNI/CE y Fichas).
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">Gestión Académica:</span>{' '}
                            Lic. Oscar Ortiz Regalao (Horarios, Prerrequisitos y Sílabos).
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">
                              Portales Independientes:
                            </span>{' '}
                            Portal Docente (Carga y Notas) · Portal Estudiante (Matrícula y CPE).
                          </li>
                        </ul>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                        Next.js 15 App Router · React 19
                      </div>
                    </div>

                    {/* Capa 2 */}
                    <div className="border border-slate-200 rounded-md p-4 bg-slate-50/60 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-mono text-blue-700 font-semibold">
                          CAPA 02 · DOMINIO Y REGLAS DE NEGOCIO
                        </p>
                        <h4 className="text-sm font-display font-bold text-slate-900 mt-1">
                          Motores de Validación Académica
                        </h4>
                        <ul className="mt-3 space-y-2 text-xs text-slate-700">
                          <li>
                            <span className="font-semibold text-slate-900">Motor de Admisión:</span>{' '}
                            Ordinario, Exonerados (1.° y 2.° puesto), Deportistas IPD, Ley 29973
                            CONADIS (5%).
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">
                              Validador de Matrícula:
                            </span>{' '}
                            Grafo de prerrequisitos curriculares + bloqueo por alerta de morosidad.
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">
                              Motor Anti-Cruces:
                            </span>{' '}
                            Verificación determinista de intersección [Inicio, Fin) en Aula, Docente
                            y Ciclo.
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">
                              Evaluación MINEDU:
                            </span>{' '}
                            Indicadores IL1, IL2, IL3 en escala vigesimal (00-20, nota mínima 13).
                          </li>
                        </ul>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                        Lineamientos Académicos Generales MINEDU
                      </div>
                    </div>

                    {/* Capa 3 */}
                    <div className="border border-slate-200 rounded-md p-4 bg-slate-50/60 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-mono text-blue-700 font-semibold">
                          CAPA 03 · INTEROPERABILIDAD PERÚ
                        </p>
                        <h4 className="text-sm font-display font-bold text-slate-900 mt-1">
                          Facturación SUNAT & Identidad
                        </h4>
                        <ul className="mt-3 space-y-2 text-xs text-slate-700">
                          <li>
                            <span className="font-semibold text-slate-900">
                              Facturación UBL 2.1:
                            </span>{' '}
                            Emisión en tiempo real de Boletas (B001) y Facturas (F001) con firma
                            XAdES-BES.
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">
                              Régimen Tributario:
                            </span>{' '}
                            Inafecto de IGV (Art. 2° inc. g TUO Ley del IGV — Servicios Educativos).
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">
                              Validación Identidad:
                            </span>{' '}
                            Padrón DNI (8 dígitos RENIEC) y Carné de Extranjería (Migraciones).
                          </li>
                        </ul>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                        OSE / SUNAT Operaciones en Línea (CDR)
                      </div>
                    </div>

                    {/* Capa 4 */}
                    <div className="border border-slate-200 rounded-md p-4 bg-slate-50/60 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-mono text-blue-700 font-semibold">
                          CAPA 04 · PERSISTENCIA Y SEGURIDAD
                        </p>
                        <h4 className="text-sm font-display font-bold text-slate-900 mt-1">
                          Cloud Firestore & Reglas ABAC
                        </h4>
                        <ul className="mt-3 space-y-2 text-xs text-slate-700">
                          <li>
                            <span className="font-semibold text-slate-900">
                              Colecciones Tiempo Real:
                            </span>{' '}
                            <code className="font-mono">applicants</code>,{' '}
                            <code className="font-mono">enrollments</code>,{' '}
                            <code className="font-mono">grades</code>,{' '}
                            <code className="font-mono">schedules</code>,{' '}
                            <code className="font-mono">invoices</code>.
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">
                              Bloqueo de Estado Terminal:
                            </span>{' '}
                            Actas con <code className="font-mono">VISADO_DIRECTOR</code> y
                            Resoluciones con <code className="font-mono">ADMITIDO_DIRECTORAL</code>{' '}
                            son inmutables.
                          </li>
                          <li>
                            <span className="font-semibold text-slate-900">Aislamiento PII:</span>{' '}
                            Consultas aseguradas por propietario y verificación de correo.
                          </li>
                        </ul>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                        Google Cloud Firestore Enterprise
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TABLA / MATRIZ TÉCNICA DE LOS 7 MÓDULOS */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-display font-bold text-slate-900">
                      02. Matriz Estructural de Módulos, Actores, Reglas Críticas y Políticas de
                      Acceso
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Especificación formal de ingeniería de software para el Instituto de Educación
                      Superior Tecnológico ITMANV.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                        <th className="py-3.5 px-4 w-48">Módulo del Sistema</th>
                        <th className="py-3.5 px-4 w-72">Funcionalidades Clave</th>
                        <th className="py-3.5 px-4 w-64">Actores Involucrados</th>
                        <th className="py-3.5 px-4 w-80">
                          Reglas de Negocio Críticas (Perú / SUNAT / MINEDU)
                        </th>
                        <th className="py-3.5 px-4 w-64">Políticas de Acceso (RBAC / ABAC)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs text-slate-700 align-top">
                      {SIA_ARCHITECTURE_MATRIX.map((mod) => (
                        <tr key={mod.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-4">
                            <p className="font-mono text-blue-700 font-semibold">{mod.code}</p>
                            <p className="font-display font-bold text-slate-900 mt-1 text-sm">
                              {mod.moduleName}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <ul className="space-y-1.5">
                              {mod.keyFunctionalities.map((fn, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  • {fn}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-4 px-4">
                            <ul className="space-y-1.5">
                              {mod.involvedActors.map((actor, idx) => (
                                <li key={idx} className="leading-relaxed font-medium text-slate-800">
                                  • {actor}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-4 px-4">
                            <ul className="space-y-2">
                              {mod.criticalBusinessRules.map((rule, idx) => (
                                <li key={idx} className="leading-relaxed text-slate-800">
                                  {rule}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-4 px-4">
                            <ul className="space-y-1.5 text-slate-600">
                              {mod.accessPolicies.map((pol, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  • {pol}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PLANES DE ESTUDIO Y PRERREQUISITOS DE AMBAS CARRERAS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(['ADM_EMP', 'ADM_BAN'] as ProgramCode[]).map((progKey) => {
                  const prog = TECHNICAL_PROGRAMS[progKey];
                  return (
                    <div
                      key={prog.code}
                      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <div className="p-5 border-b border-slate-200">
                        <p className="text-xs font-mono text-blue-700">{prog.cnoCode}</p>
                        <h3 className="text-base font-display font-bold text-slate-900 mt-1">
                          Carrera Técnica: {prog.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Título a Nombre de la Nación: {prog.degreeTitle} · {prog.totalCredits}{' '}
                          Créditos · {prog.cycles} Ciclos
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                              <th className="py-2.5 px-4">Código</th>
                              <th className="py-2.5 px-4">Unidad Didáctica</th>
                              <th className="py-2.5 px-4">Ciclo</th>
                              <th className="py-2.5 px-4 text-right">Créd.</th>
                              <th className="py-2.5 px-4">Prerrequisito</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-700">
                            {courses
                              .filter((c) => c.programId === progKey)
                              .map((c) => (
                                <tr key={c.id || c.code} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                                    {c.code}
                                  </td>
                                  <td className="py-2.5 px-4">
                                    <p className="font-medium text-slate-900">{c.name}</p>
                                    <p className="text-slate-500 text-[11px]">{c.competencyUnit}</p>
                                  </td>
                                  <td className="py-2.5 px-4 font-mono">{c.cycle}</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                                    {c.credits}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-slate-600">
                                    {c.prerequisiteCode || 'Ninguno (I Ciclo)'}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 02: ADMISIÓN Y MODALIDADES PERUANAS
             ===================================================================== */}
          {activeTab === 'admision' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                  <div>
                    <h2 className="text-xl font-display font-bold text-slate-900">
                      Módulo de Admisión y Control de Modalidades (Ley N.° 30512)
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Validación de expediente por{' '}
                      <span className="font-semibold text-slate-900">
                        Lic. Emerita Vásquez Suárez
                      </span>{' '}
                      (Trámite Documentario) · Adjudicación de vacante por Resolución Directoral del{' '}
                      <span className="font-semibold text-slate-900">Lic. Elmer Torres Peres</span>{' '}
                      (Director General).
                    </p>
                  </div>
                  <div className="text-xs text-slate-600 font-mono bg-slate-50 px-3.5 py-2 rounded border border-slate-200">
                    Meta Vacantes 2026-II: 40 por Carrera · Reserva CONADIS: mín. 5%
                  </div>
                </div>

                {/* Formulario de Inscripción de Postulante */}
                <form
                  onSubmit={handleCreateApplicant}
                  className="mt-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tipo Doc. Identidad
                    </label>
                    <select
                      value={newApplicant.documentType}
                      onChange={(e) =>
                        setNewApplicant({
                          ...newApplicant,
                          documentType: e.target.value as 'DNI' | 'CE',
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="DNI">DNI (RENIEC - 8 díg.)</option>
                      <option value="CE">Carné Extranjería (CE)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      N.° Documento
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={newApplicant.documentType === 'DNI' ? '74829103' : '004892105'}
                      value={newApplicant.documentNumber}
                      onChange={(e) =>
                        setNewApplicant({ ...newApplicant, documentNumber: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Apellidos y Nombres Completos
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Quispe Mendoza, Juan Carlos"
                      value={newApplicant.fullName}
                      onChange={(e) =>
                        setNewApplicant({ ...newApplicant, fullName: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Carrera Técnica
                    </label>
                    <select
                      value={newApplicant.programId}
                      onChange={(e) =>
                        setNewApplicant({
                          ...newApplicant,
                          programId: e.target.value as ProgramCode,
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="ADM_EMP">Administración de Empresas</option>
                      <option value="ADM_BAN">Negocios Bancarios y Financieros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Modalidad de Admisión
                    </label>
                    <select
                      value={newApplicant.modality}
                      onChange={(e) =>
                        setNewApplicant({
                          ...newApplicant,
                          modality: e.target.value as ApplicantDoc['modality'],
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="ORDINARIO">Examen Ordinario</option>
                      <option value="EXONERADO_PRIMEROS_PUESTOS">
                        Exonerado (1.° y 2.° Puesto)
                      </option>
                      <option value="DEPORTISTA_CALIFICADO">Deportista Calificado (IPD)</option>
                      <option value="CONADIS">Ley 29973 — CONADIS (5%)</option>
                      <option value="TRASLADO_EXTERNO">Traslado Externo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Puntaje (0-100)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newApplicant.examScore}
                      onChange={(e) =>
                        setNewApplicant({ ...newApplicant, examScore: Number(e.target.value) })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="md:col-span-2 lg:col-span-5 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={!user}
                      className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Registrar Expediente de Postulación en Firestore</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabla de Postulantes */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-display font-bold text-slate-900">
                    Padrón de Postulantes y Estado de Resoluciones Directorales
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por DNI/CE o apellidos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-3 px-4">Documento</th>
                        <th className="py-3 px-4">Postulante</th>
                        <th className="py-3 px-4">Carrera Técnica</th>
                        <th className="py-3 px-4">Modalidad Perú</th>
                        <th className="py-3 px-4 text-right">Puntaje</th>
                        <th className="py-3 px-4">Estado de Carpeta</th>
                        <th className="py-3 px-4">Resolución / Autoridad</th>
                        <th className="py-3 px-4 text-right">Acciones de Rol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {filteredApplicants.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            No hay expedientes registrados. Haz clic en &ldquo;Cargar Datos Base
                            ITMANV&rdquo; arriba a la derecha para poblar Firestore.
                          </td>
                        </tr>
                      ) : (
                        filteredApplicants.map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono font-medium text-slate-900">
                              {app.documentType} · {app.documentNumber}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">{app.fullName}</td>
                            <td className="py-3 px-4">
                              {TECHNICAL_PROGRAMS[app.programId]?.name || app.programId}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                              {app.modality.replace(/_/g, ' ')}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                              {app.examScore} pts
                            </td>
                            <td className="py-3 px-4">
                              {app.dossierStatus === 'ADMITIDO_DIRECTORAL' ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Admitido Directoral
                                </span>
                              ) : app.dossierStatus === 'VALIDADO_TRAMITE' ? (
                                <span className="text-blue-700 font-medium">
                                  Validado por Trámite
                                </span>
                              ) : app.dossierStatus === 'OBSERVADO' ? (
                                <span className="text-amber-700 font-medium">
                                  Carpeta Observada
                                </span>
                              ) : (
                                <span className="text-slate-600">Pendiente Revisión</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-mono text-slate-900">{app.resolutionNumber}</p>
                              <p className="text-slate-500 text-[11px]">{app.validatedBy}</p>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              {app.dossierStatus !== 'ADMITIDO_DIRECTORAL' && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleAdvanceApplicantState(app, 'VALIDADO_TRAMITE')
                                    }
                                    className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors"
                                    title="Validar carpeta como Lic. Emerita Vásquez Suárez"
                                  >
                                    Validar (Trámite)
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleAdvanceApplicantState(app, 'ADMITIDO_DIRECTORAL')
                                    }
                                    className="px-2.5 py-1 text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white rounded transition-colors"
                                    title="Emitir Resolución Directoral como Lic. Elmer Torres Peres"
                                  >
                                    Emitir RD (Director)
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedApplicantCertificate(app)}
                                className="px-2.5 py-1 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded transition-colors inline-flex items-center gap-1"
                                title="Generar y visualizar Constancia Oficial de Ingreso"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Constancia de Ingreso</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sección de Constancias Oficiales de Ingreso por cada Ingresante */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-sm font-display font-bold text-slate-900">
                      Constancias Oficiales de Ingreso por Ingresante — Proceso de Admisión 2026-II
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Documentos oficiales respaldados por Resolución Directoral (
                      <span className="font-semibold text-slate-900">Lic. Elmer Torres Peres</span>)
                      y validación de carpeta (
                      <span className="font-semibold text-slate-900">
                        Lic. Emerita Vásquez Suárez
                      </span>
                      ) habilitados para formalizar matrícula.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    Total expedientes listados: {filteredApplicants.length}
                  </span>
                </div>

                {filteredApplicants.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Carga los datos base o registra un postulante para emitir sus Constancias de
                    Ingreso.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredApplicants.map((app) => {
                      const rdNumber =
                        app.resolutionNumber && app.resolutionNumber !== 'En trámite'
                          ? app.resolutionNumber
                          : `RD-ITMANV-2026-0${app.documentNumber.slice(-3)}`;
                      return (
                        <div
                          key={`cert-${app.id}`}
                          className="border border-slate-200 rounded-lg p-4 bg-slate-50/60 flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                              <span>
                                {app.documentType} {app.documentNumber}
                              </span>
                              <span className="font-semibold text-blue-700">{rdNumber}</span>
                            </div>
                            <h4 className="text-sm font-display font-bold text-slate-900">
                              {app.fullName}
                            </h4>
                            <p className="text-xs text-slate-700 font-medium">
                              {TECHNICAL_PROGRAMS[app.programId]?.name || app.programId}
                            </p>
                            <div className="pt-1 text-[11px] text-slate-600 space-y-0.5">
                              <p>
                                Modalidad:{' '}
                                <span className="font-mono text-slate-800">
                                  {app.modality.replace(/_/g, ' ')}
                                </span>
                              </p>
                              <p>
                                Puntaje de Mérito:{' '}
                                <span className="font-mono font-semibold text-emerald-700">
                                  {app.examScore} / 100 pts (VACANTE ADJUDICADA)
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedApplicantCertificate(app)}
                              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-600" />
                              <span>Ver Constancia</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                downloadAdmissionCertificatePdf(app);
                                notify(
                                  'success',
                                  `Constancia de Ingreso de ${app.fullName} descargada en PDF.`
                                );
                              }}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Descargar PDF</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 03: MATRÍCULAS, FICHAS DNI/CE Y VALIDACIÓN DE MOROSIDAD
             ===================================================================== */}
          {activeTab === 'matriculas' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="pb-5 border-b border-slate-200">
                  <h2 className="text-xl font-display font-bold text-slate-900">
                    Módulo de Matrículas Semestrales y Emisión de Fichas Oficiales
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Reglas Críticas Activas: (1) Verificación de identidad DNI/CE por{' '}
                    <span className="font-semibold text-slate-900">
                      Lic. Emerita Vásquez Suárez
                    </span>
                    , (2) Control de prerrequisitos por{' '}
                    <span className="font-semibold text-slate-900">Lic. Oscar Ortiz Regalao</span>,
                    y (3) Bloqueo automático si el alumno registra deuda vencida en Tesorería.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateEnrollment}
                  className="mt-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end"
                >
                  <div className="md:col-span-3 lg:col-span-6 bg-slate-50 border border-slate-200 rounded p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-700" />
                      <span>Sincronizar desde Padrón de Estudiantes:</span>
                    </span>
                    <select
                      onChange={(e) => {
                        const std = allStudentsDirectory.find((s) => s.documentNumber === e.target.value);
                        if (std) {
                          setNewEnrollment({
                            ...newEnrollment,
                            studentDocType: std.documentType,
                            studentDocNumber: std.documentNumber,
                            studentName: std.fullName,
                            programId: std.programId,
                            cycle: std.cycle,
                            shift: std.shift,
                          });
                        }
                      }}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white font-mono max-w-full sm:max-w-md"
                    >
                      <option value="">-- Seleccionar estudiante del padrón ITMANV --</option>
                      {allStudentsDirectory.map((std) => (
                        <option key={std.documentNumber} value={std.documentNumber}>
                          {std.documentType} {std.documentNumber} — {std.fullName} ({std.programId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tipo Documento
                    </label>
                    <select
                      value={newEnrollment.studentDocType}
                      onChange={(e) =>
                        setNewEnrollment({
                          ...newEnrollment,
                          studentDocType: e.target.value as 'DNI' | 'CE',
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="DNI">DNI (8 dígitos)</option>
                      <option value="CE">Carné de Extranjería</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      N.° DNI / CE
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="74829103"
                      value={newEnrollment.studentDocNumber}
                      onChange={(e) =>
                        setNewEnrollment({ ...newEnrollment, studentDocNumber: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Estudiante
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Apellidos y Nombres del Estudiante"
                      value={newEnrollment.studentName}
                      onChange={(e) =>
                        setNewEnrollment({ ...newEnrollment, studentName: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Carrera Técnica
                    </label>
                    <select
                      value={newEnrollment.programId}
                      onChange={(e) =>
                        setNewEnrollment({
                          ...newEnrollment,
                          programId: e.target.value as ProgramCode,
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="ADM_EMP">Administración de Empresas</option>
                      <option value="ADM_BAN">Negocios Bancarios y Financieros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Ciclo / Turno
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={newEnrollment.cycle}
                        onChange={(e) =>
                          setNewEnrollment({
                            ...newEnrollment,
                            cycle: e.target.value as EnrollmentDoc['cycle'],
                          })
                        }
                        className="w-1/2 border border-slate-300 rounded-md px-2 py-2 text-xs bg-white font-mono"
                      >
                        {['I', 'II', 'III', 'IV', 'V', 'VI'].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newEnrollment.shift}
                        onChange={(e) =>
                          setNewEnrollment({
                            ...newEnrollment,
                            shift: e.target.value as EnrollmentDoc['shift'],
                          })
                        }
                        className="w-1/2 border border-slate-300 rounded-md px-2 py-2 text-xs bg-white"
                      >
                        <option value="DIURNO">Diurno</option>
                        <option value="NOCTURNO">Nocturno</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      N.° Boleta SUNAT
                    </label>
                    <input
                      type="text"
                      required
                      value={newEnrollment.sunatReceiptNumber}
                      onChange={(e) =>
                        setNewEnrollment({
                          ...newEnrollment,
                          sunatReceiptNumber: e.target.value,
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Créditos (máx. 26)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={26}
                      value={newEnrollment.creditsEnrolled}
                      onChange={(e) =>
                        setNewEnrollment({
                          ...newEnrollment,
                          creditsEnrolled: Number(e.target.value),
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2 pt-4">
                    <input
                      id="prereq-check"
                      type="checkbox"
                      checked={newEnrollment.prerequisitesVerified}
                      onChange={(e) =>
                        setNewEnrollment({
                          ...newEnrollment,
                          prerequisitesVerified: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-700"
                    />
                    <label htmlFor="prereq-check" className="text-xs text-slate-700">
                      Prerrequisitos aprobados verificados (Lic. Oscar Ortiz Regalao)
                    </label>
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={!user}
                      className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Procesar Ficha de Matrícula</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Listado de Fichas de Matrícula */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-display font-bold text-slate-900">
                    Registro de Fichas de Matrícula Semestral (2026-II)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-3 px-4">DNI / CE</th>
                        <th className="py-3 px-4">Estudiante</th>
                        <th className="py-3 px-4">Carrera Técnica</th>
                        <th className="py-3 px-4">Ciclo · Turno</th>
                        <th className="py-3 px-4 text-right">Créditos</th>
                        <th className="py-3 px-4">Boleta SUNAT</th>
                        <th className="py-3 px-4">Estado Matrícula / Morosidad</th>
                        <th className="py-3 px-4 text-right">Ficha Oficial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {filteredEnrollments.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            No hay matrículas registradas aún.
                          </td>
                        </tr>
                      ) : (
                        filteredEnrollments.map((enr) => (
                          <tr key={enr.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono font-medium text-slate-900">
                              {enr.studentDocType} · {enr.studentDocNumber}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {enr.studentName}
                            </td>
                            <td className="py-3 px-4">
                              {TECHNICAL_PROGRAMS[enr.programId]?.name}
                            </td>
                            <td className="py-3 px-4 font-mono">
                              Ciclo {enr.cycle} · {enr.shift}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {enr.creditsEnrolled} cr.
                            </td>
                            <td className="py-3 px-4 font-mono text-blue-700">
                              {enr.sunatReceiptNumber}
                            </td>
                            <td className="py-3 px-4">
                              {enr.hasDebtAlert || enr.status === 'OBSERVADO_TESORERIA' ? (
                                <span className="text-red-600 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Observado por Deuda Morosa
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Matriculado · Solvente
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedEnrollmentPreview(enr)}
                                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors inline-flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Ver Ficha</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 04: GESTIÓN DE NOTAS POR COMPETENCIAS Y ACTAS MINEDU
             ===================================================================== */}
          {activeTab === 'notas' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="pb-5 border-b border-slate-200">
                  <h2 className="text-xl font-display font-bold text-slate-900">
                    Módulo de Gestión de Notas por Competencias y Actas Oficiales MINEDU
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Escala vigesimal (00 a 20) con nota mínima aprobatoria 13. Cierre académico por{' '}
                    <span className="font-semibold text-slate-900">Lic. Oscar Ortiz Regalao</span> y
                    Visado Directoral inmutable por{' '}
                    <span className="font-semibold text-slate-900">Lic. Elmer Torres Peres</span>.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateGrade}
                  className="mt-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 items-end"
                >
                  <div className="md:col-span-3 lg:col-span-7 bg-slate-50 border border-slate-200 rounded p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-700" />
                      <span>Sincronizar desde Padrón de Estudiantes:</span>
                    </span>
                    <select
                      onChange={(e) => {
                        const std = allStudentsDirectory.find((s) => s.documentNumber === e.target.value);
                        if (std) {
                          const progCourses = courses.filter((c) => c.programId === std.programId);
                          setNewGrade({
                            ...newGrade,
                            studentDocNumber: std.documentNumber,
                            studentName: std.fullName,
                            programId: std.programId,
                            cycle: std.cycle,
                            courseCode: progCourses[0]?.code || newGrade.courseCode,
                          });
                        }
                      }}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white font-mono max-w-full sm:max-w-md"
                    >
                      <option value="">-- Seleccionar estudiante del padrón ITMANV --</option>
                      {allStudentsDirectory.map((std) => (
                        <option key={std.documentNumber} value={std.documentNumber}>
                          {std.documentType} {std.documentNumber} — {std.fullName} ({std.programId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      DNI / CE Estudiante
                    </label>
                    <input
                      type="text"
                      required
                      value={newGrade.studentDocNumber}
                      onChange={(e) =>
                        setNewGrade({ ...newGrade, studentDocNumber: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Apellidos y Nombres
                    </label>
                    <input
                      type="text"
                      required
                      value={newGrade.studentName}
                      onChange={(e) => setNewGrade({ ...newGrade, studentName: e.target.value })}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Carrera Técnica
                    </label>
                    <select
                      value={newGrade.programId}
                      onChange={(e) => {
                        const prog = e.target.value as ProgramCode;
                        const progCourses = courses.filter((c) => c.programId === prog);
                        setNewGrade({
                          ...newGrade,
                          programId: prog,
                          courseCode: progCourses[0]?.code || '',
                          cycle: progCourses[0]?.cycle || 'I',
                        });
                      }}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="ADM_EMP">Administración de Empresas</option>
                      <option value="ADM_BAN">Negocios Bancarios y Financieros</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Unidad Didáctica (Sincronizada)
                    </label>
                    <select
                      value={newGrade.courseCode}
                      onChange={(e) => {
                        const course = courses.find((c) => c.code === e.target.value);
                        setNewGrade({
                          ...newGrade,
                          courseCode: e.target.value,
                          cycle: course ? course.cycle : newGrade.cycle,
                        });
                      }}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      {courses
                        .filter((c) => c.programId === newGrade.programId)
                        .map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.code} — {c.name} (Ciclo {c.cycle} · {c.credits} cr.)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Docente Evaluador
                    </label>
                    <select
                      value={newGrade.teacherName}
                      onChange={(e) => setNewGrade({ ...newGrade, teacherName: e.target.value })}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      IL1 / IL2 / IL3 (0-20)
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={newGrade.il1}
                        onChange={(e) => setNewGrade({ ...newGrade, il1: Number(e.target.value) })}
                        className="border border-slate-300 rounded px-2 py-2 text-xs font-mono text-center"
                        title="Indicador de Logro 1"
                      />
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={newGrade.il2}
                        onChange={(e) => setNewGrade({ ...newGrade, il2: Number(e.target.value) })}
                        className="border border-slate-300 rounded px-2 py-2 text-xs font-mono text-center"
                        title="Indicador de Logro 2"
                      />
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={newGrade.il3}
                        onChange={(e) => setNewGrade({ ...newGrade, il3: Number(e.target.value) })}
                        className="border border-slate-300 rounded px-2 py-2 text-xs font-mono text-center"
                        title="Indicador de Logro 3"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-7 flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={!user}
                      className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Registrar Calificación por Competencias</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabla de Actas de Evaluación */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-display font-bold text-slate-900">
                      Actas de Evaluación por Indicadores de Logro (IL1, IL2, IL3)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Reporte oficial estructurado para presentación ante MINEDU (DRELM / REGISTRA) con hojas consolidadas y por carrera técnica.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={filteredGrades.length === 0}
                    onClick={() => {
                      exportConsolidatedGradesToExcel(filteredGrades);
                      notify(
                        'success',
                        `Acta Consolidada MINEDU (${filteredGrades.length} registros) exportada en formato Excel (.xlsx).`
                      );
                    }}
                    className="px-3.5 py-2 bg-emerald-700 text-white text-xs font-medium rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Acta Consolidada MINEDU (.xlsx)</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-3 px-4">DNI / Estudiante</th>
                        <th className="py-3 px-4">Unidad Didáctica</th>
                        <th className="py-3 px-4 text-right">IL1</th>
                        <th className="py-3 px-4 text-right">IL2</th>
                        <th className="py-3 px-4 text-right">IL3</th>
                        <th className="py-3 px-4 text-right">Prom. Final</th>
                        <th className="py-3 px-4">Nivel de Logro MINEDU</th>
                        <th className="py-3 px-4">Estado de Acta</th>
                        <th className="py-3 px-4 text-right">Cierre / Visado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {filteredGrades.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            Sin registros de notas en esta vista.
                          </td>
                        </tr>
                      ) : (
                        filteredGrades.map((g) => (
                          <tr key={g.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{g.studentName}</p>
                              <p className="font-mono text-slate-500 text-[11px]">
                                Doc: {g.studentDocNumber}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">
                                {g.courseCode} · {g.courseName}
                              </p>
                              <p className="text-slate-500 text-[11px]">
                                Ciclo {g.cycle} · Docente: {g.teacherName}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">{g.il1}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">{g.il2}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">{g.il3}</td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${
                                g.finalAverage >= 13 ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {String(g.finalAverage).padStart(2, '0')}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px]">
                              {g.competencyState.replace(/_/g, ' ')}
                            </td>
                            <td className="py-3 px-4">
                              {g.actaStatus === 'VISADO_DIRECTOR' ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Visado Director (Lic. Elmer Torres)
                                </span>
                              ) : g.actaStatus === 'CERRADO_ACADEMICA' ? (
                                <span className="text-blue-700 font-medium">
                                  Cerrado Unidad Académica
                                </span>
                              ) : (
                                <span className="text-slate-600">Abierto al Docente</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              {g.actaStatus === 'ABIERTO_DOCENTE' && (
                                <button
                                  onClick={() => handleAdvanceActaStatus(g, 'CERRADO_ACADEMICA')}
                                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                                >
                                  Cerrar Acta (Lic. Oscar Ortiz)
                                </button>
                              )}
                              {g.actaStatus !== 'VISADO_DIRECTOR' && (
                                <button
                                  onClick={() => handleAdvanceActaStatus(g, 'VISADO_DIRECTOR')}
                                  className="px-2.5 py-1 text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white rounded"
                                >
                                  Visar Acta (Director)
                                </button>
                              )}
                              {g.actaStatus === 'VISADO_DIRECTOR' && (
                                <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Acta Cerrada
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 05: HORARIOS CON VALIDACIÓN ANTI-CRUCES
             ===================================================================== */}
          {activeTab === 'horarios' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="pb-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-display font-bold text-slate-900">
                      Módulo de Programación Horaria con Motor Anti-Cruces
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Supervisado por{' '}
                      <span className="font-semibold text-slate-900">
                        Lic. Oscar Ortiz Regalao
                      </span>{' '}
                      (Jefe de Unidad Académica). El motor impide colisiones de Aula, Docente o
                      Sección/Ciclo en el mismo rango horario.
                    </p>
                  </div>
                  <div
                    className={`px-3.5 py-2 rounded border text-xs font-medium flex items-center gap-2 ${
                      scheduleCollisionAnalysis.hasCollision
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {scheduleCollisionAnalysis.hasCollision ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span>{scheduleCollisionAnalysis.reason}</span>
                  </div>
                </div>

                <form
                  onSubmit={handleCreateSchedule}
                  className="mt-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Carrera Técnica
                    </label>
                    <select
                      value={newSchedule.programId}
                      onChange={(e) => {
                        const prog = e.target.value as ProgramCode;
                        const progCourses = courses.filter((c) => c.programId === prog);
                        setNewSchedule({
                          ...newSchedule,
                          programId: prog,
                          courseCode: progCourses[0]?.code || '',
                          cycle: progCourses[0]?.cycle || 'I',
                        });
                      }}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="ADM_EMP">Administración de Empresas</option>
                      <option value="ADM_BAN">Negocios Bancarios y Financieros</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Unidad Didáctica (Sincronizada)
                    </label>
                    <select
                      value={newSchedule.courseCode}
                      onChange={(e) => {
                        const course = courses.find((c) => c.code === e.target.value);
                        setNewSchedule({
                          ...newSchedule,
                          courseCode: e.target.value,
                          cycle: course ? course.cycle : newSchedule.cycle,
                        });
                      }}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      {courses
                        .filter((c) => c.programId === newSchedule.programId)
                        .map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.code} — {c.name} (Ciclo {c.cycle} · {c.credits} cr.)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Docente Asignado (Plana Docente)
                    </label>
                    <select
                      value={newSchedule.teacherName}
                      onChange={(e) =>
                        setNewSchedule({ ...newSchedule, teacherName: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Aula / Laboratorio
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="LAB-FIN-101"
                      value={newSchedule.classroom}
                      onChange={(e) =>
                        setNewSchedule({ ...newSchedule, classroom: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Día de Semana
                    </label>
                    <select
                      value={newSchedule.dayOfWeek}
                      onChange={(e) =>
                        setNewSchedule({
                          ...newSchedule,
                          dayOfWeek: e.target.value as ScheduleDoc['dayOfWeek'],
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Hora Inicio
                    </label>
                    <input
                      type="time"
                      value={newSchedule.startTime}
                      onChange={(e) =>
                        setNewSchedule({ ...newSchedule, startTime: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Hora Fin
                    </label>
                    <input
                      type="time"
                      value={newSchedule.endTime}
                      onChange={(e) => setNewSchedule({ ...newSchedule, endTime: e.target.value })}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="md:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={!user || scheduleCollisionAnalysis.hasCollision}
                      className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Programar Bloque Horario Libre de Cruces</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Grilla de Horarios */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-sm font-display font-bold text-slate-900">
                    Programación Horaria Oficial Semestre 2026-II
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-3 px-4">Día y Bloque Horario</th>
                        <th className="py-3 px-4">Aula / Lab.</th>
                        <th className="py-3 px-4">Carrera y Ciclo</th>
                        <th className="py-3 px-4">Unidad Didáctica</th>
                        <th className="py-3 px-4">Docente Responsable</th>
                        <th className="py-3 px-4">Sílabo MINEDU</th>
                        <th className="py-3 px-4 text-right">Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {filteredSchedules.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No hay bloques horarios registrados.
                          </td>
                        </tr>
                      ) : (
                        filteredSchedules.map((sch) => (
                          <tr key={sch.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                              {sch.dayOfWeek} · {sch.startTime} – {sch.endTime}
                            </td>
                            <td className="py-3 px-4 font-mono text-blue-700 font-medium">
                              {sch.classroom}
                            </td>
                            <td className="py-3 px-4">
                              {TECHNICAL_PROGRAMS[sch.programId]?.name} · Ciclo {sch.cycle}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {sch.courseCode} — {sch.courseName}
                            </td>
                            <td className="py-3 px-4">{sch.teacherName}</td>
                            <td className="py-3 px-4 text-emerald-700 font-medium">
                              {sch.syllabusStatus}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteRecord('schedules', sch.id)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Liberar Aula
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 06: TESORERÍA, MOROSIDAD Y FACTURACIÓN ELECTRÓNICA SUNAT
             ===================================================================== */}
          {activeTab === 'tesoreria' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="pb-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-display font-bold text-slate-900">
                      Tesorería, Alertas de Morosidad y Facturación Electrónica SUNAT (UBL 2.1)
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Emisión en tiempo real de Boletas Electrónicas (Serie{' '}
                      <span className="font-mono font-semibold">B001</span>) y Facturas (Serie{' '}
                      <span className="font-mono font-semibold">F001</span>) Inafectas al IGV
                      conforme al Art. 2° inciso g) del TUO de la Ley del IGV (Servicios
                      Educativos).
                    </p>
                  </div>
                  <div className="text-xs font-mono bg-slate-50 px-3.5 py-2 rounded border border-slate-200 shrink-0">
                    RUC ITMANV: 20608491024 · OSE SUNAT: EN LÍNEA
                  </div>
                </div>

                <form
                  onSubmit={handleEmitSunatInvoice}
                  className="mt-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tipo de CPE SUNAT
                    </label>
                    <select
                      value={newInvoice.voucherType}
                      onChange={(e) =>
                        setNewInvoice({
                          ...newInvoice,
                          voucherType: e.target.value as InvoiceDoc['voucherType'],
                          customerDocType:
                            e.target.value === 'FACTURA_ELECTRONICA' ? 'RUC' : 'DNI',
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="BOLETA_ELECTRONICA">Boleta de Venta (Serie B001)</option>
                      <option value="FACTURA_ELECTRONICA">Factura Electrónica (Serie F001)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Doc. Receptor ({newInvoice.customerDocType})
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={newInvoice.customerDocType === 'RUC' ? '20548912031' : '74829103'}
                      value={newInvoice.customerDocNumber}
                      onChange={(e) =>
                        setNewInvoice({ ...newInvoice, customerDocNumber: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Estudiante / Razón Social
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Apellidos y Nombres o Razón Social"
                      value={newInvoice.customerName}
                      onChange={(e) =>
                        setNewInvoice({ ...newInvoice, customerName: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Concepto Académico Facturable
                    </label>
                    <input
                      type="text"
                      required
                      value={newInvoice.concept}
                      onChange={(e) => setNewInvoice({ ...newInvoice, concept: e.target.value })}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Importe Total (S/)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50000}
                      step="0.50"
                      value={newInvoice.amountPen}
                      onChange={(e) =>
                        setNewInvoice({ ...newInvoice, amountPen: Number(e.target.value) })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Estado de Cobranza
                    </label>
                    <select
                      value={newInvoice.paymentStatus}
                      onChange={(e) =>
                        setNewInvoice({
                          ...newInvoice,
                          paymentStatus: e.target.value as InvoiceDoc['paymentStatus'],
                        })
                      }
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white"
                    >
                      <option value="PAGADO">Pagado · Emitir CPE</option>
                      <option value="VENCIDO_MOROSO">Vencido · Activar Morosidad</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Fecha Vencimiento
                    </label>
                    <input
                      type="date"
                      value={newInvoice.dueDate}
                      onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <div className="md:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={!user}
                      className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      <ReceiptText className="w-3.5 h-3.5" />
                      <span>Emitir Comprobante Electrónico SUNAT en Tiempo Real</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Libro de Comprobantes Electrónicos y Morosidad */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-sm font-display font-bold text-slate-900">
                    Registro de Comprobantes Electrónicos (B001 / F001) y Semáforo de Morosidad
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-3 px-4">Serie y Número</th>
                        <th className="py-3 px-4">Receptor (DNI/CE/RUC)</th>
                        <th className="py-3 px-4">Concepto</th>
                        <th className="py-3 px-4 text-right">Monto (Inafecto IGV)</th>
                        <th className="py-3 px-4">Estado Tesorería</th>
                        <th className="py-3 px-4">Estado CDR SUNAT</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No hay comprobantes emitidos aún.
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {inv.seriesNumber}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{inv.customerName}</p>
                              <p className="font-mono text-slate-500 text-[11px]">
                                {inv.customerDocType}: {inv.customerDocNumber}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-slate-900">{inv.concept}</p>
                              <p className="font-mono text-slate-500 text-[11px]">
                                Vence: {inv.dueDate} · Hash: {inv.sunatHashCpe.slice(0, 16)}...
                              </p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                              S/ {inv.amountPen.toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              {inv.paymentStatus === 'PAGADO' ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Pagado
                                </span>
                              ) : (
                                <span className="text-red-600 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Vencido · Moroso
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-emerald-700">
                              {inv.sunatCdrStatus}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                onClick={() => handleToggleInvoicePaymentStatus(inv)}
                                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors"
                              >
                                {inv.paymentStatus === 'PAGADO'
                                  ? 'Marcar Moroso'
                                  : 'Liquidar Deuda'}
                              </button>
                              <button
                                onClick={() => setSelectedInvoicePreview(inv)}
                                className="px-2.5 py-1 text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white rounded transition-colors inline-flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Ver Boleta SUNAT</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 07: PORTALES INDEPENDIENTES (ESTUDIANTE Y DOCENTE)
             ===================================================================== */}
          {activeTab === 'portales' && (
            <div className="space-y-6">
              {/* Selector de Portal Independiente */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-900">
                    Portales Independientes de Autogestión (Estudiante y Docente)
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Vistas con aislamiento de políticas de acceso: el Portal Estudiante verifica en
                    vivo la ausencia de deudas vencidas en Tesorería antes de exhibir el récord de
                    notas.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                  <button
                    onClick={() => setPortalSubView('ESTUDIANTE')}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      portalSubView === 'ESTUDIANTE'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Portal del Estudiante
                  </button>
                  <button
                    onClick={() => setPortalSubView('DOCENTE')}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      portalSubView === 'DOCENTE'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Portal del Docente
                  </button>
                </div>
              </div>

              {portalSubView === 'ESTUDIANTE' ? (
                <div className="space-y-6">
                  {/* Selector de Expediente Estudiantil por DNI/CE */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Simulador de Sesión Estudiantil por Documento de Identidad (DNI / CE)
                      </p>
                      <p className="text-sm font-display font-bold text-slate-900 mt-0.5">
                        Selecciona un estudiante para inspeccionar su Ficha, Horario, Notas y Estado
                        de Cuenta SUNAT
                      </p>
                    </div>
                    <select
                      value={selectedStudentDoc}
                      onChange={(e) => setSelectedStudentDoc(e.target.value)}
                      className="border border-slate-300 rounded-md px-3.5 py-2 text-xs font-mono bg-white max-w-full sm:max-w-md"
                    >
                      {allStudentsDirectory.map((std) => (
                        <option key={std.documentNumber} value={std.documentNumber}>
                          {std.documentType} {std.documentNumber} — {std.fullName} ({std.isSolvent ? 'Solvente' : 'Con Alerta Morosidad'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const selectedStudentItem = allStudentsDirectory.find(
                      (s) => s.documentNumber === selectedStudentDoc
                    );
                    const studentEnrollment = enrollments.find(
                      (e) => e.studentDocNumber === selectedStudentDoc
                    );
                    const studentInvoices = invoices.filter(
                      (i) => i.customerDocNumber === selectedStudentDoc
                    );
                    const studentGrades = grades.filter(
                      (g) => g.studentDocNumber === selectedStudentDoc
                    );
                    const hasMorosidad =
                      studentEnrollment?.hasDebtAlert ||
                      (selectedStudentItem ? !selectedStudentItem.isSolvent : false) ||
                      studentInvoices.some((i) => i.paymentStatus === 'VENCIDO_MOROSO');
                    const overdueInvoice =
                      studentInvoices.find((i) => i.paymentStatus === 'VENCIDO_MOROSO') ||
                      studentInvoices.find((i) => i.paymentStatus !== 'PAGADO') ||
                      studentInvoices[0] ||
                      null;

                    const effectiveName =
                      studentEnrollment?.studentName || selectedStudentItem?.fullName || 'Estudiante';
                    const effectiveDocType =
                      studentEnrollment?.studentDocType || selectedStudentItem?.documentType || 'DNI';
                    const effectiveDocNum =
                      studentEnrollment?.studentDocNumber ||
                      selectedStudentItem?.documentNumber ||
                      selectedStudentDoc;
                    const effectiveProgId =
                      studentEnrollment?.programId || selectedStudentItem?.programId || 'ADM_EMP';
                    const effectiveCycle =
                      studentEnrollment?.cycle || selectedStudentItem?.cycle || 'I';
                    const effectiveShift =
                      studentEnrollment?.shift || selectedStudentItem?.shift || 'DIURNO';
                    const effectiveReceipt =
                      studentEnrollment?.sunatReceiptNumber ||
                      studentInvoices[0]?.seriesNumber ||
                      'B001-0004901';

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Columna 1: Ficha de Matrícula y Estado Financiero */}
                        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                          <h3 className="text-sm font-display font-bold text-slate-900 border-b border-slate-200 pb-3">
                            1. Situación Académica y Financiera
                          </h3>
                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Estudiante:</span>
                              <span className="font-semibold text-slate-900">{effectiveName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Documento:</span>
                              <span className="font-mono">
                                {effectiveDocType} {effectiveDocNum}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Programa:</span>
                              <span className="font-medium text-right">
                                {TECHNICAL_PROGRAMS[effectiveProgId]?.name || effectiveProgId}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Ciclo / Turno:</span>
                              <span className="font-mono">
                                Ciclo {effectiveCycle} · {effectiveShift}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">CPE Matrícula:</span>
                              <span className="font-mono text-blue-700">{effectiveReceipt}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                              <span className="text-slate-500">Solvencia Tesorería:</span>
                              {hasMorosidad ? (
                                <span className="text-red-600 font-semibold">
                                  CON DEUDA VENCIDA
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">
                                  AL DÍA · SOLVENTE
                                </span>
                              )}
                            </div>
                            {hasMorosidad && overdueInvoice && (
                              <div className="pt-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenStudentPaymentModal(overdueInvoice)}
                                  className="w-full px-3 py-2 bg-emerald-700 text-white text-xs font-medium rounded-md hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>
                                    Pagar ahora (S/ {overdueInvoice.amountPen.toFixed(2)})
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Columna 2: Boleta de Notas por Competencias (con Bloqueo por Morosidad) */}
                        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                          <h3 className="text-sm font-display font-bold text-slate-900 border-b border-slate-200 pb-3">
                            2. Boleta de Notas por Competencias y Comprobantes Electrónicos SUNAT
                          </h3>

                          {hasMorosidad ? (
                            <div className="p-5 bg-red-50 border border-red-200 rounded-md space-y-3">
                              <div className="flex items-center gap-2 text-red-800 font-semibold text-xs">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>
                                  RESTRICCIÓN AUTOMÁTICA POR MOROSIDAD (Regla de Negocio RN-POR-01)
                                </span>
                              </div>
                              <p className="text-xs text-red-700 leading-relaxed">
                                Estimado(a) estudiante: El módulo de Tesorería reporta una cuota
                                vencida asociada al documento{' '}
                                <span className="font-mono font-bold">{selectedStudentDoc}</span>
                                {overdueInvoice
                                  ? ` (${overdueInvoice.seriesNumber} — ${overdueInvoice.concept} por S/ ${overdueInvoice.amountPen.toFixed(2)})`
                                  : ''}
                                . La visualización de calificaciones oficiales y la inscripción en
                                el siguiente ciclo se rehabilitan de forma automática e inmediata al
                                cancelar tu Boleta Electrónica SUNAT.
                              </p>
                              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                                {overdueInvoice && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStudentPaymentModal(overdueInvoice)}
                                    className="px-4 py-2 bg-emerald-700 text-white text-xs font-medium rounded-md hover:bg-emerald-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    <span>Pagar ahora</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('tesoreria')}
                                  className="px-3.5 py-2 bg-white border border-red-300 text-red-800 text-xs font-medium rounded-md hover:bg-red-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <span>Ver Detalle en Tesorería</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                      <th className="py-2 px-3">Unidad Didáctica</th>
                                      <th className="py-2 px-3 text-right">IL1</th>
                                      <th className="py-2 px-3 text-right">IL2</th>
                                      <th className="py-2 px-3 text-right">IL3</th>
                                      <th className="py-2 px-3 text-right">Promedio</th>
                                      <th className="py-2 px-3">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {studentGrades.length === 0 ? (
                                      <tr>
                                        <td colSpan={6} className="py-6 text-center text-slate-500">
                                          <p className="font-medium text-slate-700">
                                            Sin calificaciones registradas aún en el acta oficial para este periodo.
                                          </p>
                                          <p className="text-[11px] text-slate-400 mt-1">
                                            Las notas vigesimales (00-20) por Indicadores de Logro (IL1, IL2, IL3) se publicarán conforme el docente efectúe el cierre académico.
                                          </p>
                                        </td>
                                      </tr>
                                    ) : (
                                      studentGrades.map((g) => (
                                        <tr key={g.id}>
                                          <td className="py-2.5 px-3 font-medium text-slate-900">
                                            {g.courseCode} — {g.courseName}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono">{g.il1}</td>
                                          <td className="py-2.5 px-3 text-right font-mono">{g.il2}</td>
                                          <td className="py-2.5 px-3 text-right font-mono">{g.il3}</td>
                                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                            {g.finalAverage}
                                          </td>
                                          <td className="py-2.5 px-3 font-mono text-[11px]">
                                            {g.competencyState.replace(/_/g, ' ')}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          <div className="pt-4 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-800 mb-2">
                              Billetera de Comprobantes Electrónicos SUNAT del Estudiante
                            </p>
                            <div className="space-y-2">
                              {studentInvoices.map((inv) => (
                                <div
                                  key={inv.id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-slate-200 rounded bg-slate-50 text-xs"
                                >
                                  <div className="space-y-0.5">
                                    <div>
                                      <span className="font-mono font-bold text-slate-900">
                                        {inv.seriesNumber}
                                      </span>{' '}
                                      · <span>{inv.concept}</span>
                                    </div>
                                    <div className="text-[11px] font-mono">
                                      Estado SUNAT:{' '}
                                      {inv.paymentStatus === 'PAGADO' ? (
                                        <span className="text-emerald-700 font-semibold">
                                          PAGADO · CDR ACEPTADO
                                        </span>
                                      ) : (
                                        <span className="text-red-600 font-semibold">
                                          {inv.paymentStatus.replace(/_/g, ' ')} · Vto.{' '}
                                          {inv.dueDate}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 self-end sm:self-center">
                                    <span className="font-mono font-semibold tabular-nums">
                                      S/ {inv.amountPen.toFixed(2)}
                                    </span>
                                    {inv.paymentStatus !== 'PAGADO' && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenStudentPaymentModal(inv)}
                                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                      >
                                        <CreditCard className="w-3 h-3" />
                                        <span>Pagar ahora</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedInvoicePreview(inv)}
                                      className="text-blue-700 hover:underline font-medium whitespace-nowrap"
                                    >
                                      Ver CPE
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* PORTAL DEL DOCENTE */
                <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
                  <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-mono text-blue-700">
                        PORTAL DOCENTE · CARGA LECTIVA Y SÍLABOS POR COMPETENCIAS
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-slate-700">Docente Titular:</span>
                        <select
                          value={selectedTeacherForPortal}
                          onChange={(e) => setSelectedTeacherForPortal(e.target.value)}
                          className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-900 bg-white"
                        >
                          {teachers.map((t) => (
                            <option key={t.id} value={t.name}>
                              {t.name} ({t.title})
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Asignación visada por el Jefe de Unidad Académica: Lic. Oscar Ortiz Regalao
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start">
                      <button
                        type="button"
                        disabled={grades.length === 0}
                        onClick={() => {
                          exportConsolidatedGradesToExcel(grades);
                          notify(
                            'success',
                            `Acta Consolidada MINEDU (${grades.length} registros) exportada en formato Excel (.xlsx).`
                          );
                        }}
                        className="px-3.5 py-2 bg-emerald-700 text-white text-xs font-medium rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar Actas MINEDU (.xlsx)</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('notas')}
                        className="px-3.5 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        Ir a Registro de Notas por Indicadores (IL1-IL3)
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-3 px-4">Código / Unidad Didáctica</th>
                          <th className="py-3 px-4">Programa de Estudios</th>
                          <th className="py-3 px-4">Ciclo</th>
                          <th className="py-3 px-4">Horario Asignado</th>
                          <th className="py-3 px-4">Aula / Laboratorio</th>
                          <th className="py-3 px-4">Estado del Sílabo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700">
                        {(() => {
                          const teacherSchedules = schedules.filter(
                            (s) =>
                              s.teacherName.trim().toLowerCase() ===
                                selectedTeacherForPortal.trim().toLowerCase() ||
                              selectedTeacherForPortal
                                .toLowerCase()
                                .includes(s.teacherName.toLowerCase()) ||
                              s.teacherName
                                .toLowerCase()
                                .includes(selectedTeacherForPortal.toLowerCase())
                          );

                          if (teacherSchedules.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-500">
                                  <p className="font-semibold text-slate-700">
                                    {selectedTeacherForPortal} no registra horarios asignados en el periodo 2026-II.
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    Puedes asignarle unidades didácticas y ambientes en el Módulo de Programación Horaria.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewSchedule((prev) => ({
                                        ...prev,
                                        teacherName: selectedTeacherForPortal,
                                      }));
                                      setActiveTab('horarios');
                                    }}
                                    className="mt-3 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                                  >
                                    <CalendarClock className="w-3.5 h-3.5" />
                                    <span>Programar Horario para este Docente</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          }

                          return teacherSchedules.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-medium text-slate-900">
                                {s.courseCode} — {s.courseName}
                              </td>
                              <td className="py-3 px-4">{TECHNICAL_PROGRAMS[s.programId]?.name}</td>
                              <td className="py-3 px-4 font-mono">Ciclo {s.cycle}</td>
                              <td className="py-3 px-4 font-mono">
                                {s.dayOfWeek} · {s.startTime} – {s.endTime}
                              </td>
                              <td className="py-3 px-4 font-mono text-blue-700">{s.classroom}</td>
                              <td className="py-3 px-4 text-emerald-700 font-semibold">
                                {s.syllabusStatus}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              TAB 08: CATÁLOGOS Y ENTIDADES (CURSOS, DOCENTES, ALUMNOS)
             ===================================================================== */}
          {activeTab === 'catalogos' && (
            <div className="space-y-6">
              {/* Header de Gestión de Entidades */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      SINCRONIZACIÓN TRANSVERSAL
                    </span>
                    <span className="text-xs text-slate-500 font-medium">SIA ITMANV v2.4</span>
                  </div>
                  <h2 className="text-xl font-display font-bold text-slate-900 mt-1">
                    08. Catálogos y Mantenimiento de Entidades Académicas
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    Administra y edita Unidades Didácticas (Cursos), Plana Docente y el Padrón Estudiantil. Todos los cambios se sincronizan en tiempo real en los módulos de Matrículas, Registro de Notas por Competencias, Programación Horaria, Portales y Fichas Oficiales.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
                  <button
                    onClick={() => {
                      setCatalogSubTab('CURSOS');
                      setCatalogSearch('');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      catalogSubTab === 'CURSOS'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BookMarked className="w-3.5 h-3.5 text-blue-700" />
                    <span>Unidades Didácticas ({courses.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setCatalogSubTab('DOCENTES');
                      setCatalogSearch('');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      catalogSubTab === 'DOCENTES'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                    <span>Plana Docente ({teachers.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setCatalogSubTab('ALUMNOS');
                      setCatalogSearch('');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      catalogSubTab === 'ALUMNOS'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-blue-700" />
                    <span>Padrón Alumnos ({allStudentsDirectory.length})</span>
                  </button>
                </div>
              </div>

              {/* VISTA 1: UNIDADES DIDÁCTICAS (CURSOS) */}
              {catalogSubTab === 'CURSOS' && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Buscar por código o nombre..."
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        Total:{' '}
                        <span className="font-semibold text-slate-800 font-mono">
                          {courses.length} unidades didácticas
                        </span>
                      </span>
                    </div>

                    <button
                      onClick={handleOpenNewCourseModal}
                      className="px-3.5 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 transition-colors flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Unidad Didáctica</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-3 px-4">Código</th>
                          <th className="py-3 px-4">Unidad Didáctica / Competencia</th>
                          <th className="py-3 px-4">Carrera Técnica</th>
                          <th className="py-3 px-4">Ciclo</th>
                          <th className="py-3 px-4 text-right">Créditos</th>
                          <th className="py-3 px-4">Prerrequisito</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700">
                        {courses
                          .filter((c) => {
                            if (!catalogSearch.trim()) return true;
                            const q = catalogSearch.toLowerCase();
                            return (
                              c.code.toLowerCase().includes(q) ||
                              c.name.toLowerCase().includes(q) ||
                              c.competencyUnit.toLowerCase().includes(q)
                            );
                          })
                          .map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-blue-700">
                                {c.code}
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-900">{c.name}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                  {c.competencyUnit}
                                </p>
                              </td>
                              <td className="py-3 px-4">
                                {TECHNICAL_PROGRAMS[c.programId]?.name || c.programId}
                              </td>
                              <td className="py-3 px-4 font-mono">Ciclo {c.cycle}</td>
                              <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                                {c.credits} cr.
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px]">
                                {c.prerequisiteCode ? (
                                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded">
                                    {c.prerequisiteCode}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Sin prerrequisito</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenEditCourseModal(c)}
                                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3 text-slate-600" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteCourse(c.id)}
                                  className="px-2.5 py-1 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                  <span>Eliminar</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VISTA 2: PLANA DOCENTE ITMANV */}
              {catalogSubTab === 'DOCENTES' && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre o correo..."
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        Total:{' '}
                        <span className="font-semibold text-slate-800 font-mono">
                          {teachers.length} docentes activos
                        </span>
                      </span>
                    </div>

                    <button
                      onClick={handleOpenNewTeacherModal}
                      className="px-3.5 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 transition-colors flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Registrar Nuevo Docente</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-3 px-4">Docente e Identificación</th>
                          <th className="py-3 px-4">Correo Institucional</th>
                          <th className="py-3 px-4">Teléfono de Contacto</th>
                          <th className="py-3 px-4">Área / Carrera</th>
                          <th className="py-3 px-4">Oficina / Despacho</th>
                          <th className="py-3 px-4 text-center">Horas en Horario</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700">
                        {teachers
                          .filter((t) => {
                            if (!catalogSearch.trim()) return true;
                            const q = catalogSearch.toLowerCase();
                            return (
                              t.name.toLowerCase().includes(q) ||
                              t.email.toLowerCase().includes(q) ||
                              t.title.toLowerCase().includes(q)
                            );
                          })
                          .map((t) => {
                            const assignedBlocks = schedules.filter(
                              (s) =>
                                s.teacherName.toLowerCase().includes(t.name.toLowerCase()) ||
                                t.name.toLowerCase().includes(s.teacherName.toLowerCase())
                            ).length;

                            return (
                              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4">
                                  <p className="font-semibold text-slate-900">{t.name}</p>
                                  <p className="text-[11px] text-slate-500 font-medium">{t.title}</p>
                                </td>
                                <td className="py-3 px-4 font-mono text-blue-700">{t.email}</td>
                                <td className="py-3 px-4 font-mono">{t.phone}</td>
                                <td className="py-3 px-4">
                                  {t.programId === 'ADM_EMP'
                                    ? 'Adm. Empresas'
                                    : t.programId === 'ADM_BAN'
                                    ? 'Banca y Finanzas'
                                    : 'Departamento General'}
                                </td>
                                <td className="py-3 px-4 text-slate-600">{t.office}</td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                                      assignedBlocks > 0
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {assignedBlocks} {assignedBlocks === 1 ? 'bloque' : 'bloques'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    onClick={() => handleOpenEditTeacherModal(t)}
                                    className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors inline-flex items-center gap-1"
                                  >
                                    <Edit3 className="w-3 h-3 text-slate-600" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTeacher(t.id)}
                                    className="px-2.5 py-1 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-600" />
                                    <span>Eliminar</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VISTA 3: PADRÓN ESTUDIANTIL SINCRONIZADO */}
              {catalogSubTab === 'ALUMNOS' && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Buscar por DNI/CE o apellidos..."
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        Total:{' '}
                        <span className="font-semibold text-slate-800 font-mono">
                          {allStudentsDirectory.length} estudiantes en el padrón
                        </span>
                      </span>
                    </div>

                    <button
                      onClick={handleOpenNewStudentModal}
                      className="px-3.5 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 transition-colors flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Incorporar Nuevo Estudiante</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-3 px-4">Documento Identidad</th>
                          <th className="py-3 px-4">Apellidos y Nombres</th>
                          <th className="py-3 px-4">Carrera Técnica</th>
                          <th className="py-3 px-4">Ciclo · Turno</th>
                          <th className="py-3 px-4">Solvencia Tesorería (SUNAT)</th>
                          <th className="py-3 px-4">Estado Matrícula</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700">
                        {allStudentsDirectory
                          .filter((s) => {
                            if (!catalogSearch.trim()) return true;
                            const q = catalogSearch.toLowerCase();
                            return (
                              s.documentNumber.toLowerCase().includes(q) ||
                              s.fullName.toLowerCase().includes(q)
                            );
                          })
                          .map((s) => (
                            <tr key={s.documentNumber} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 font-mono font-medium text-slate-900">
                                {s.documentType} · {s.documentNumber}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900">{s.fullName}</td>
                              <td className="py-3 px-4">
                                {TECHNICAL_PROGRAMS[s.programId]?.name || s.programId}
                              </td>
                              <td className="py-3 px-4 font-mono">
                                Ciclo {s.cycle} · {s.shift}
                              </td>
                              <td className="py-3 px-4">
                                {s.isSolvent ? (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Solvente (Sin Deuda)
                                  </span>
                                ) : (
                                  <span className="text-red-600 font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                    Alerta de Morosidad
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                    s.status === 'MATRICULADO'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : s.status === 'OBSERVADO_TESORERIA'
                                      ? 'bg-red-50 text-red-700'
                                      : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  {s.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenEditStudentModal(s)}
                                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3 text-slate-600" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(s.documentNumber)}
                                  className="px-2.5 py-1 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                  <span>Eliminar</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* =====================================================================
          MODAL 1: REPRESENTACIÓN IMPRESA DE BOLETA ELECTRÓNICA SUNAT (UBL 2.1)
         ===================================================================== */}
      {selectedInvoicePreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO ITMANV
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Autorizado por MINEDU · Dirección General: Lic. Elmer Torres Peres
                </p>
              </div>
              <div className="border border-slate-900 px-3 py-2 text-center font-mono text-xs">
                <p className="font-bold">R.U.C. 20608491024</p>
                <p className="font-bold text-blue-700 mt-0.5">
                  {selectedInvoicePreview.voucherType === 'BOLETA_ELECTRONICA'
                    ? 'BOLETA DE VENTA ELECTRÓNICA'
                    : 'FACTURA ELECTRÓNICA'}
                </p>
                <p className="font-bold mt-0.5">{selectedInvoicePreview.seriesNumber}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs border-b border-slate-200 pb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Adquirente / Estudiante:</span>
                <span className="font-semibold text-slate-900">
                  {selectedInvoicePreview.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Documento ({selectedInvoicePreview.customerDocType}):
                </span>
                <span className="font-mono font-semibold">
                  {selectedInvoicePreview.customerDocNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Carrera Técnica:</span>
                <span>{TECHNICAL_PROGRAMS[selectedInvoicePreview.programId]?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Moneda / Régimen IGV:</span>
                <span className="font-mono">
                  SOLES (PEN) · INAFECTO ART. 2° INC. G LEY IGV
                </span>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1.5 text-left">Cant.</th>
                    <th className="py-1.5 text-left">Descripción del Servicio Educativo</th>
                    <th className="py-1.5 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2.5 font-mono">1.00</td>
                    <td className="py-2.5 font-medium text-slate-900">
                      {selectedInvoicePreview.concept}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      S/ {selectedInvoicePreview.amountPen.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>OP. INAFECTA (EDUCACIÓN):</span>
                  <span>S/ {selectedInvoicePreview.amountPen.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>I.G.V. (0.00% - Art. 2° inc. g D.S. 055-99-EF):</span>
                  <span>S/ 0.00</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                  <span>IMPORTE TOTAL:</span>
                  <span>S/ {selectedInvoicePreview.amountPen.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
              <p>
                <span className="font-semibold text-slate-900">Resumen Hash CPE (UBL 2.1):</span>{' '}
                {selectedInvoicePreview.sunatHashCpe}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Estado CDR SUNAT:</span>{' '}
                {selectedInvoicePreview.sunatCdrStatus} · Autorizado mediante Resolución de
                Superintendencia N.° 097-2012/SUNAT
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => downloadInvoicePdf(selectedInvoicePreview)}
                className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar como PDF</span>
              </button>
              <button
                onClick={() => setSelectedInvoicePreview(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                Cerrar Representación Impresa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: FICHA OFICIAL DE MATRÍCULA (MINEDU / ITMANV)
         ===================================================================== */}
      {selectedEnrollmentPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-xl w-full p-6 shadow-xl space-y-5">
            <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-mono text-blue-700 font-semibold">
                  FICHA OFICIAL DE MATRÍCULA SEMESTRAL · PERIODO 2026-II
                </p>
                <h3 className="text-base font-display font-bold text-slate-900 mt-1">
                  Instituto de Educación Superior Tecnológico ITMANV
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-slate-800">
                {selectedEnrollmentPreview.studentDocType}:{' '}
                {selectedEnrollmentPreview.studentDocNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded border border-slate-200">
              <div>
                <p className="text-slate-500">Estudiante:</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {selectedEnrollmentPreview.studentName}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Programa de Estudios:</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {TECHNICAL_PROGRAMS[selectedEnrollmentPreview.programId]?.name}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Ciclo Académico y Turno:</p>
                <p className="font-mono font-semibold mt-0.5">
                  Ciclo {selectedEnrollmentPreview.cycle} · Turno {selectedEnrollmentPreview.shift}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Comprobante SUNAT Vinculado:</p>
                <p className="font-mono font-semibold text-blue-700 mt-0.5">
                  {selectedEnrollmentPreview.sunatReceiptNumber}
                </p>
              </div>
            </div>

            <div className="text-xs space-y-2">
              <p className="font-semibold text-slate-900">
                Unidades Didácticas del Plan Curricular ({selectedEnrollmentPreview.creditsEnrolled}{' '}
                créditos inscritos):
              </p>
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2 px-3">Código</th>
                      <th className="py-2 px-3">Unidad Didáctica</th>
                      <th className="py-2 px-3 text-right">Créditos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {courses
                      .filter((c) => c.programId === selectedEnrollmentPreview.programId)
                      .slice(0, 5)
                      .map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 px-3 font-mono">{c.code}</td>
                          <td className="py-2 px-3">{c.name}</td>
                          <td className="py-2 px-3 text-right font-mono">{c.credits}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-[11px] text-center text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">Lic. Emerita Vásquez Suárez</p>
                <p>Jefe de Trámite Documentario</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Lic. Oscar Ortiz Regalao</p>
                <p>Jefe de Unidad Académica</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Lic. Elmer Torres Peres</p>
                <p>Director General ITMANV</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() =>
                  downloadEnrollmentPdf(
                    selectedEnrollmentPreview,
                    courses.filter((c) => c.programId === selectedEnrollmentPreview.programId)
                  )
                }
                className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar como PDF</span>
              </button>
              <button
                onClick={() => setSelectedEnrollmentPreview(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                Cerrar Ficha de Matrícula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: CONSTANCIA OFICIAL DE INGRESO (ADMISIÓN MINEDU / ITMANV)
         ===================================================================== */}
      {selectedApplicantCertificate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO ITMANV
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Autorizado por MINEDU · Ley N.° 30512 · Dirección General: Lic. Elmer Torres Peres
                </p>
              </div>
              <div className="border border-slate-900 px-3 py-2 text-center font-mono text-xs shrink-0">
                <p className="font-bold text-blue-700">CONSTANCIA DE INGRESO</p>
                <p className="font-bold text-slate-900 mt-0.5">ADMISIÓN 2026-II</p>
                <p className="text-[11px] text-slate-700 mt-0.5">
                  {selectedApplicantCertificate.resolutionNumber &&
                  selectedApplicantCertificate.resolutionNumber !== 'En trámite'
                    ? selectedApplicantCertificate.resolutionNumber
                    : `RD-ITMANV-2026-0${selectedApplicantCertificate.documentNumber.slice(-3)}`}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed space-y-2">
              <p className="font-semibold text-slate-900 uppercase tracking-wide text-center bg-slate-100 py-2 px-3 rounded border border-slate-200">
                Constancia Oficial de Adjudicación de Vacante e Ingreso
              </p>
              <p>
                El Director General y la Jefa de Trámite Documentario del{' '}
                <span className="font-semibold text-slate-900">
                  Instituto de Educación Superior Tecnológico ITMANV
                </span>{' '}
                que suscriben, en cumplimiento de la Ley N.° 30512 y el Reglamento Institucional de
                Admisión, hacen constar que el(la) postulante ha alcanzado vacante conforme al
                siguiente detalle oficial:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded border border-slate-200">
              <div className="sm:col-span-2">
                <p className="text-slate-500">Ingresante Admitido(a):</p>
                <p className="font-display font-bold text-sm text-slate-900 mt-0.5">
                  {selectedApplicantCertificate.fullName}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Documento de Identidad:</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {selectedApplicantCertificate.documentType} N.°{' '}
                  {selectedApplicantCertificate.documentNumber}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Modalidad de Admisión Perú:</p>
                <p className="font-mono font-semibold text-blue-700 mt-0.5">
                  {selectedApplicantCertificate.modality.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-slate-500">Carrera Técnica Profesional Adjudicada:</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {TECHNICAL_PROGRAMS[selectedApplicantCertificate.programId]?.name} (
                  {TECHNICAL_PROGRAMS[selectedApplicantCertificate.programId]?.cnoCode})
                </p>
              </div>
              <div>
                <p className="text-slate-500">Puntaje de Evaluación / Mérito:</p>
                <p className="font-mono font-bold text-emerald-700 mt-0.5">
                  {selectedApplicantCertificate.examScore} / 100.00 pts (VACANTE ADJUDICADA)
                </p>
              </div>
              <div>
                <p className="text-slate-500">Resolución Directoral y Validación:</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {selectedApplicantCertificate.resolutionNumber &&
                  selectedApplicantCertificate.resolutionNumber !== 'En trámite'
                    ? selectedApplicantCertificate.resolutionNumber
                    : `RD-ITMANV-2026-0${selectedApplicantCertificate.documentNumber.slice(-3)}`}
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded text-[11px] text-slate-700">
              <p className="font-semibold text-slate-900">
                Habilitación para Matrícula Semestral (Ciclo I — Periodo 2026-II):
              </p>
              <p className="mt-0.5">
                La presente constancia habilita al ingresante a registrar su Ficha Oficial de
                Matrícula previo pago de derechos en Tesorería mediante Boleta de Venta Electrónica
                SUNAT (Inafecta de IGV según Art. 2° inc. g del TUO de la Ley del IGV).
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-[11px] text-center text-slate-600">
              <div>
                <p className="font-semibold text-slate-900">Lic. Emerita Vásquez Suárez</p>
                <p>Jefe de Trámite Documentario</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Lic. Oscar Ortiz Regalao</p>
                <p>Jefe de Unidad Académica</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Lic. Elmer Torres Peres</p>
                <p>Director General ITMANV</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadAdmissionCertificatePdf(selectedApplicantCertificate)
                }
                className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Constancia como PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedApplicantCertificate(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                Cerrar Constancia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: PASARELA DE PAGO EN LÍNEA ESTUDIANTIL Y LIQUIDACIÓN SUNAT
         ===================================================================== */}
      {studentPaymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 gap-4">
              <div>
                <p className="text-xs font-mono font-bold text-emerald-700">
                  PASARELA DE RECAUDACIÓN EN LÍNEA · SIA ITMANV
                </p>
                <h3 className="text-base font-display font-bold text-slate-900 mt-1">
                  Cancelación de Deuda y Actualización de CPE SUNAT
                </h3>
              </div>
              <div className="border border-slate-900 px-3 py-1.5 text-center font-mono text-xs shrink-0">
                <p className="font-bold text-slate-900">
                  {studentPaymentModalInvoice.seriesNumber}
                </p>
                <p className="text-[11px] text-red-600 font-semibold">POR LIQUIDAR</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Estudiante Titular:</span>
                <span className="font-semibold text-slate-900">
                  {studentPaymentModalInvoice.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Documento ({studentPaymentModalInvoice.customerDocType}):
                </span>
                <span className="font-mono font-semibold text-slate-900">
                  {studentPaymentModalInvoice.customerDocNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Concepto Académico:</span>
                <span className="font-medium text-slate-900 text-right">
                  {studentPaymentModalInvoice.concept}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Afectación Tributaria SUNAT:</span>
                <span className="font-mono text-[11px] text-slate-700">
                  Inafecto IGV (Art. 2° inc. g Ley IGV)
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="font-semibold text-slate-900">Importe Total a Pagar:</span>
                <span className="font-mono text-base font-bold text-emerald-700">
                  S/ {studentPaymentModalInvoice.amountPen.toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmStudentOnlinePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-2">
                  Selecciona el Medio de Pago Electrónico
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('YAPE_PLIN')}
                    className={`p-2.5 text-left border rounded-md text-xs transition-colors ${
                      paymentMethod === 'YAPE_PLIN'
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <p>Yape / Plin QR</p>
                    <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Billetera interoperable
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TARJETA_VISA_MC')}
                    className={`p-2.5 text-left border rounded-md text-xs transition-colors ${
                      paymentMethod === 'TARJETA_VISA_MC'
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <p>Tarjeta Débito/Créd.</p>
                    <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Visa / Mastercard
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PAGOEFECTIVO_CIP')}
                    className={`p-2.5 text-left border rounded-md text-xs transition-colors ${
                      paymentMethod === 'PAGOEFECTIVO_CIP'
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <p>PagoEfectivo CIP</p>
                    <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Banca móvil / Agentes
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Número de Operación / Código de Autorización Simulado
                </label>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Levantamiento Automático de Morosidad (RN-POR-01)</span>
                </p>
                <p className="text-emerald-800">
                  Al confirmar el pago, el estado de la boleta{' '}
                  <span className="font-mono font-bold">
                    {studentPaymentModalInvoice.seriesNumber}
                  </span>{' '}
                  cambiará a <span className="font-mono font-bold">PAGADO</span> y se desbloqueará
                  de inmediato tu Boleta de Notas por Competencias.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentPaymentModalInvoice(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-800 text-xs font-medium rounded-md hover:bg-slate-200 whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processingStudentPayment}
                  className="px-4 py-2 bg-emerald-700 text-white text-xs font-medium rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>
                    {processingStudentPayment
                      ? 'Procesando Pago SUNAT...'
                      : `Confirmar Pago (S/ ${studentPaymentModalInvoice.amountPen.toFixed(2)})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: EDICIÓN / CREACIÓN DE UNIDAD DIDÁCTICA (CURSO)
         ===================================================================== */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-mono font-bold text-blue-700">
                  CATÁLOGO CURRICULAR · SIA ITMANV
                </p>
                <h3 className="text-base font-display font-bold text-slate-900 mt-0.5">
                  {editingCourse ? 'Editar Unidad Didáctica' : 'Nueva Unidad Didáctica Modular'}
                </h3>
              </div>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
                MINEDU / CNO
              </span>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Código de Unidad Didáctica *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. AE-302 o BF-105"
                    value={courseForm.code}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })
                    }
                    className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Carrera Técnica *
                  </label>
                  <select
                    value={courseForm.programId}
                    onChange={(e) =>
                      setCourseForm({
                        ...courseForm,
                        programId: e.target.value as ProgramCode,
                      })
                    }
                    className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white"
                  >
                    <option value="ADM_EMP">Administración de Empresas</option>
                    <option value="ADM_BAN">Negocios Bancarios y Financieros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nombre de la Unidad Didáctica *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Finanzas Corporativas y Evaluación de Créditos"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ciclo *</label>
                  <select
                    value={courseForm.cycle}
                    onChange={(e) =>
                      setCourseForm({
                        ...courseForm,
                        cycle: e.target.value as CourseItem['cycle'],
                      })
                    }
                    className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white font-mono"
                  >
                    {['I', 'II', 'III', 'IV', 'V', 'VI'].map((c) => (
                      <option key={c} value={c}>
                        Ciclo {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Créditos (1-10) *</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={courseForm.credits}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, credits: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Prerrequisito</label>
                  <select
                    value={courseForm.prerequisiteCode || ''}
                    onChange={(e) =>
                      setCourseForm({
                        ...courseForm,
                        prerequisiteCode: e.target.value ? e.target.value : null,
                      })
                    }
                    className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white font-mono"
                  >
                    <option value="">Sin prerrequisito</option>
                    {courses
                      .filter((c) => c.code !== courseForm.code)
                      .map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Unidad de Competencia (Currículo por Competencias)
                </label>
                <input
                  type="text"
                  placeholder="Ej. UC2: Gestionar operaciones comerciales y de crédito"
                  value={courseForm.competencyUnit}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, competencyUnit: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-800 font-medium rounded-md hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 text-white font-medium rounded-md hover:bg-blue-800 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingCourse ? 'Guardar Cambios' : 'Registrar Unidad Didáctica'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 6: EDICIÓN / REGISTRO DE DOCENTE
         ===================================================================== */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-mono font-bold text-blue-700">
                  PLANA DOCENTE INSTITUCIONAL · ITMANV
                </p>
                <h3 className="text-base font-display font-bold text-slate-900 mt-0.5">
                  {editingTeacher ? 'Editar Docente' : 'Registrar Nuevo Docente'}
                </h3>
              </div>
              <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-200">
                Unidad Académica
              </span>
            </div>

            <form onSubmit={handleSaveTeacher} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Apellidos y Nombres Completos *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Mg. Carlos Mendoza Quispe"
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Grado Académico / Título *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Magíster en Finanzas"
                    value={teacherForm.title}
                    onChange={(e) => setTeacherForm({ ...teacherForm, title: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Departamento / Carrera
                  </label>
                  <select
                    value={teacherForm.programId}
                    onChange={(e) =>
                      setTeacherForm({
                        ...teacherForm,
                        programId: e.target.value as TeacherItem['programId'],
                      })
                    }
                    className="w-full border border-slate-300 rounded-md px-3 py-2 bg-white"
                  >
                    <option value="ADM_EMP">Administración de Empresas</option>
                    <option value="ADM_BAN">Negocios Bancarios y Financieros</option>
                    <option value="AMBAS">Ambas Carreras Técnicas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Correo Institucional *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="docente@itmanv.edu.pe"
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 984 512 870"
                    value={teacherForm.phone}
                    onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Oficina / Despacho Institucional
                </label>
                <input
                  type="text"
                  placeholder="Ej. Sala de Docentes - Pabellón A"
                  value={teacherForm.office}
                  onChange={(e) => setTeacherForm({ ...teacherForm, office: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-800 font-medium rounded-md hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 text-white font-medium rounded-md hover:bg-blue-800 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingTeacher ? 'Guardar Cambios' : 'Registrar Docente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 7: EDICIÓN / REGISTRO DE ALUMNO EN EL PADRÓN
         ===================================================================== */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-mono font-bold text-blue-700">
                  PADRÓN ESTUDIANTIL · SIA ITMANV
                </p>
                <h3 className="text-base font-display font-bold text-slate-900 mt-0.5">
                  {editingStudent ? 'Editar Estudiante' : 'Incorporar Nuevo Estudiante'}
                </h3>
              </div>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
                DNI / CE RENIEC
              </span>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Documento *</label>
                  <select
                    value={studentForm.documentType}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        documentType: e.target.value as 'DNI' | 'CE',
                      })
                    }
                    className="w-full border border-slate-300 rounded-md px-2.5 py-2 bg-white"
                  >
                    <option value="DNI">DNI (8 dígitos)</option>
                    <option value="CE">Carné Extr.</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Número de Documento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="74829103"
                    value={studentForm.documentNumber}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, documentNumber: e.target.value.trim() })
                    }
                    className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Apellidos y Nombres Completos *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Lucía Fernanda Rojas Huamán"
                  value={studentForm.fullName}
                  onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Carrera Técnica *</label>
                  <select
                    value={studentForm.programId}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        programId: e.target.value as ProgramCode,
                      })
                    }
                    className="w-full border border-slate-300 rounded-md px-2 py-2 bg-white"
                  >
                    <option value="ADM_EMP">Adm. Empresas</option>
                    <option value="ADM_BAN">Banca y Finanzas</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ciclo *</label>
                  <select
                    value={studentForm.cycle}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        cycle: e.target.value as StudentItem['cycle'],
                      })
                    }
                    className="w-full border border-slate-300 rounded-md px-2 py-2 bg-white font-mono"
                  >
                    {['I', 'II', 'III', 'IV', 'V', 'VI'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Turno *</label>
                  <select
                    value={studentForm.shift}
                    onChange={(e) =>
                      setStudentForm({
                        ...studentForm,
                        shift: e.target.value as StudentItem['shift'],
                      })
                    }
                    className="w-full border border-slate-300 rounded-md px-2 py-2 bg-white"
                  >
                    <option value="DIURNO">Diurno</option>
                    <option value="NOCTURNO">Nocturno</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">Estado de Solvencia en Tesorería</p>
                    <p className="text-[11px] text-slate-500">
                      Determina si el alumno tiene deuda morosa SUNAT o acceso completo al récord.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={studentForm.isSolvent}
                      onChange={(e) =>
                        setStudentForm({
                          ...studentForm,
                          isSolvent: e.target.checked,
                          status: e.target.checked ? 'MATRICULADO' : 'OBSERVADO_TESORERIA',
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="font-mono text-[11px]">
                  {studentForm.isSolvent ? (
                    <span className="text-emerald-700 font-semibold">
                      AL DÍA · SOLVENTE (Sin Bloqueo)
                    </span>
                  ) : (
                    <span className="text-red-600 font-semibold">
                      CON ALERTA DE MOROSIDAD (Bloqueo preventivo de notas)
                    </span>
                  )}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-800 font-medium rounded-md hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 text-white font-medium rounded-md hover:bg-blue-800 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingStudent ? 'Actualizar Estudiante' : 'Incorporar al Padrón'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
