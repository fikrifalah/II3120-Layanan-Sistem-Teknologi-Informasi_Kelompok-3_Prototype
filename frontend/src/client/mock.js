/**
 * Mock data shaped like the REST spec (POST /api/v1/matching/recommend, /escrow/lock, /milestones/{id}/approve).
 * Text that the backend would return in one language is given as { id, en } here so the UI can show both.
 */

export const DEMO_JOB = {
  job_id: 'JOB-2026-089',
  job_title: {
    id: 'Pengembangan Backend Microservices & Integrasi API',
    en: 'Backend Microservices & API Integration',
  },
  category: 'backend',
  required_skills: ['FastAPI', 'PostgreSQL', 'Docker', 'Solidity', 'Redis'],
  budget: 15000, // SIM-IDR
}

export const SKILL_SUGGESTIONS = [
  'React',
  'FastAPI',
  'PostgreSQL',
  'Docker',
  'Python',
  'TypeScript',
  'Redis',
  'Solidity',
]

export const MIN_BUDGET = 1000

export const DEMO_RECOMMENDATIONS = [
  {
    freelancer_id: 'FRL-3158',
    matching_score: 91.0,
    experience_years: 4,
    matched_skills: ['FastAPI', 'PostgreSQL', 'Docker', 'Redis'],
    missing_skills: ['Solidity'],
    portfolio_summary: {
      id: 'Membangun layanan pembayaran microservices dengan FastAPI, PostgreSQL, dan Redis; deployment Docker di produksi.',
      en: 'Built payment microservices with FastAPI, PostgreSQL and Redis; Docker deployment in production.',
    },
    explanation: {
      id: 'Memenuhi 4 dari 5 keahlian utama dengan pengalaman microservices yang relevan. Belum mencantumkan bukti pengalaman pada Solidity.',
      en: 'Meets 4 of 5 core skills with relevant microservices experience. No evidence of Solidity experience is listed.',
    },
  },
  {
    freelancer_id: 'FRL-4069',
    matching_score: 82.5,
    experience_years: 3,
    matched_skills: ['FastAPI', 'PostgreSQL', 'Docker'],
    missing_skills: ['Solidity', 'Redis'],
    portfolio_summary: {
      id: 'Mengembangkan platform verifikasi klaim kesehatan berbasis microservices dengan FastAPI dan React.',
      en: 'Developed a health-claims verification platform on a FastAPI and React microservices stack.',
    },
    explanation: {
      id: 'Memenuhi 3 dari 5 keahlian utama dengan pengalaman relevan pada arsitektur microservices FastAPI, namun belum mencantumkan bukti pengalaman pada Solidity dan Redis.',
      en: 'Meets 3 of 5 core skills with relevant FastAPI microservices experience, but lists no evidence of Solidity or Redis experience.',
    },
  },
  {
    freelancer_id: 'FRL-1873',
    matching_score: 68.0,
    experience_years: 2,
    matched_skills: ['FastAPI', 'Docker'],
    missing_skills: ['PostgreSQL', 'Solidity', 'Redis'],
    portfolio_summary: {
      id: 'Membuat REST API untuk aplikasi inventaris UMKM dan menyiapkan container Docker.',
      en: 'Built REST APIs for an SME inventory app and prepared Docker containers.',
    },
    explanation: {
      id: 'Memenuhi 2 dari 5 keahlian utama. Pengalaman backend ada, tetapi belum ada bukti pada PostgreSQL, Solidity, dan Redis.',
      en: 'Meets 2 of 5 core skills. Backend experience is present, but there is no evidence of PostgreSQL, Solidity or Redis.',
    },
  },
]

const DAY = 24 * 3_600_000

export const DEMO_CONTRACT = {
  project_id: 'PRJ-2026-104',
  title: DEMO_JOB.job_title,
  freelancer_id: 'FRL-4069',
  started_at: '2026-11-12',
  review_timeout_days: 5,
  smart_contract_address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  lock_transaction_hash: '0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b',
  locked_amount: 15000,
  token_symbol: 'SIM-IDR',
  milestones: [
    {
      milestone_id: 1,
      title: {
        id: 'Desain Arsitektur API & Skema Basis Data',
        en: 'API Architecture & Database Schema Design',
      },
      amount: 6000,
      kpi_count: 3,
      status: 'released',
      approved_at: '2026-11-20',
      release_transaction_hash: '0x44a91b228910c079f3b2f6ad39fa052532c56795b733da78a91ebe6a7139912a',
    },
    {
      milestone_id: 2,
      title: {
        id: 'Implementasi Layanan & Deployment (Docker)',
        en: 'Service Implementation & Deployment (Docker)',
      },
      amount: 9000,
      kpi_count: 4,
      status: 'awaiting',
      submitted_at: '2026-11-25',
      // Demo only: pinned to "now + 4d 12h" so the countdown always shows a live value.
      review_deadline: new Date(Date.now() + 4.5 * DAY).toISOString(),
    },
  ],
}
