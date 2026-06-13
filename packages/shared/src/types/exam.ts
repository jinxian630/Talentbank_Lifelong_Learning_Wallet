export type ExamRegistrationStatus = 'registered' | 'attended' | 'passed' | 'failed';
export type XPLogSource = 'register' | 'checkin' | 'submit' | 'approve' | 'exam_redeem';

export interface CertExam {
  id: string;
  title: string;
  description: string;
  requiredXP: number;
  examDate: any;
  examUrl: string;
  maxSlots: number;
  registeredCount: number;
  bannerImageUrl?: string | null;
  steps?: string[];
  createdAt: any;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  durationHours?: number;
  issuer?: string;
  issuerLogoUrl?: string;
  tags?: string[];
}

export interface ExamRegistration {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  examId: string;
  registeredAt: any;
  status: ExamRegistrationStatus;
  certPdfUrl?: string | null;
}

export interface XPLog {
  id: string;
  amount: number;
  source: XPLogSource;
  label: string;
  createdAt: any;
}
