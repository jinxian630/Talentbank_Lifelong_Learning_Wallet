export interface Cert {
  id: string;
  title: string;
  provider: string;
  category: 'Tech' | 'Business' | 'Design' | 'Language';
  tags: string[];
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  enrollCount: number;
  isFeatured: boolean;
  badge?: 'Hot' | 'New' | 'Free' | null;
  enrollUrl: string;
  description?: string;
  skillsGained?: string[];
  archived?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface CertPreferences {
  categories: Record<string, number>;
  levels: Record<string, number>;
  priceRange?: 'free' | 'paid';
  lastUpdated: any;
}

export interface SavedCert {
  certId: string;
  savedAt: any;
}

export type CertEnrollmentStatus = 'enrolled' | 'in_progress' | 'completed';

export interface CertEnrollment {
  certId: string;
  status: CertEnrollmentStatus;
  progress: number;
  enrolledAt: any;
  completedAt: any | null;
  certificateUrl: string | null;
}
