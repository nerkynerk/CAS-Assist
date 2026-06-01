/**
 * CAS-Assist Knowledge Base Seeder
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/seed-knowledge-base.mjs
 *
 * Requires: npm install openai @supabase/supabase-js (already in project)
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ── Config ────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://rueukwztuflgpuvopmlu.supabase.co';
const SERVICE_ROLE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZXVrd3p0dWZsZ3B1dm9wbWx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDI3OTY2MSwiZXhwIjoyMDk1ODU1NjYxfQ.pMeLyuRFibatYxu-xpdNGEX4sQJ2udnOOYJyQOKIKnQ';
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL   = 'text-embedding-ada-002';

if (!OPENAI_API_KEY) {
  console.error('❌  OPENAI_API_KEY environment variable is required.');
  console.error('    Run: OPENAI_API_KEY=sk-... node scripts/seed-knowledge-base.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── CAS Knowledge Base ────────────────────────────────────────
// Each entry maps to one row in handbook_knowledge_embeddings.
// Keep content focused and factual for high cosine similarity.

const KNOWLEDGE_BASE = [
  // ── ENROLLMENT ──────────────────────────────────────────────
  {
    source: 'CAS_Enrollment_Guide',
    chunk_index: 0,
    content: 'How to enroll in CAS: Students must log in to the NEU student portal during the official enrollment period. Select your program, choose your subjects, and submit for validation. Bring your Form 5 and registration fee to the CAS Registrar Office for confirmation. Late enrollment is subject to a penalty fee.',
    metadata: { category: 'enrollment', keywords: ['enroll', 'enrollment', 'register', 'registration', 'Form 5'] },
  },
  {
    source: 'CAS_Enrollment_Guide',
    chunk_index: 1,
    content: 'Adding and dropping subjects: Students may add or drop subjects within the first two weeks of the semester. Fill out an Add/Drop form available at the CAS office. Dropping after the deadline results in a grade of W (Withdrawn). No refunds are given for dropped subjects after the second week.',
    metadata: { category: 'enrollment', keywords: ['add', 'drop', 'subject', 'withdraw', 'W grade'] },
  },
  {
    source: 'CAS_Enrollment_Guide',
    chunk_index: 2,
    content: 'Cross-enrollment: CAS students who wish to take subjects from other colleges must secure a cross-enrollment form from the CAS Dean\'s Office. Approval from both the home college and the host college is required. Maximum of 6 units may be cross-enrolled per semester.',
    metadata: { category: 'enrollment', keywords: ['cross-enroll', 'cross enrollment', 'other college'] },
  },

  // ── ACADEMIC POLICIES ───────────────────────────────────────
  {
    source: 'CAS_Academic_Policies',
    chunk_index: 0,
    content: 'Grading system in CAS: The passing grade is 3.0. Grades range from 1.0 (highest) to 5.0 (failed). A grade of INC (Incomplete) is given when a student fails to complete a major requirement. INC grades must be completed within one year or they automatically become 5.0.',
    metadata: { category: 'grades', keywords: ['grade', 'grading', 'passing', 'INC', 'incomplete', '5.0', '1.0'] },
  },
  {
    source: 'CAS_Academic_Policies',
    chunk_index: 1,
    content: 'Grade consultation: Students who wish to question or verify their grade must submit a Grade Consultation Form to their professor within two weeks after grades are posted. The professor reviews and signs the form. If unresolved, it is escalated to the Department Chair.',
    metadata: { category: 'grades', keywords: ['grade consultation', 'wrong grade', 'appeal', 'question grade'] },
  },
  {
    source: 'CAS_Academic_Policies',
    chunk_index: 2,
    content: 'Academic probation in CAS: A student is placed on academic probation if their GWA falls below 2.75 for two consecutive semesters. Probationary students are limited to 15 units per semester and must meet with their academic adviser every month.',
    metadata: { category: 'academic standing', keywords: ['probation', 'GWA', 'academic standing', 'low grades'] },
  },
  {
    source: 'CAS_Academic_Policies',
    chunk_index: 3,
    content: 'Attendance policy: Students are allowed a maximum of 20% absences per subject. Exceeding 20% absences automatically results in a grade of FA (Failure due to Absences). Three lates are equivalent to one absence. Professors record attendance every class meeting.',
    metadata: { category: 'attendance', keywords: ['absence', 'attendance', 'late', 'FA', 'failure', '20%'] },
  },
  {
    source: 'CAS_Academic_Policies',
    chunk_index: 4,
    content: 'Shifting programs: CAS students who wish to shift to another program must have a GWA of at least 2.5 and must not have any failing grades. Submit a Shifting Form to the CAS Registrar Office with approval from both the current and target department chairs. Shifting is only allowed at the start of a new semester.',
    metadata: { category: 'shifting', keywords: ['shift', 'change program', 'shifting', 'transfer program'] },
  },

  // ── SCHOLARSHIPS ────────────────────────────────────────────
  {
    source: 'CAS_Scholarship_Guide',
    chunk_index: 0,
    content: 'CAS Academic Excellence Scholarship: Students who achieve a GWA of 1.75 or higher with no failing grades and no grade below 2.0 qualify for the Academic Excellence Award. This grants a 100% tuition discount for the following semester. Apply at the CAS Dean\'s Office with your most recent grades.',
    metadata: { category: 'scholarship', keywords: ['scholarship', 'academic excellence', 'tuition discount', 'honor'] },
  },
  {
    source: 'CAS_Scholarship_Guide',
    chunk_index: 1,
    content: 'Government scholarships (CHED, DOST, LGU): CAS students may apply for external scholarships from CHED, DOST, and LGU programs. Requirements typically include a GWA of 2.0 or higher, endorsement letter from the Dean, and proof of financial need. Visit the Office of Student Affairs for the list of active scholarship programs.',
    metadata: { category: 'scholarship', keywords: ['CHED', 'DOST', 'LGU', 'government scholarship', 'financial aid'] },
  },
  {
    source: 'CAS_Scholarship_Guide',
    chunk_index: 2,
    content: 'Scholarship renewal requirements: Existing scholars must maintain the required GWA every semester to retain their scholarship. Submit your grade report to the CAS scholarship office before the deadline. Failure to submit or falling below the required GWA results in scholarship termination.',
    metadata: { category: 'scholarship', keywords: ['scholarship renewal', 'maintain scholarship', 'GWA requirement'] },
  },

  // ── DOCUMENTS ───────────────────────────────────────────────
  {
    source: 'CAS_Document_Requests',
    chunk_index: 0,
    content: 'How to request a Transcript of Records (TOR): Submit a Document Request Form at the CAS Registrar Office. Pay the processing fee at the cashier. Processing takes 5 to 7 working days. Present your official receipt when claiming. For rush processing (3 days), an additional fee applies.',
    metadata: { category: 'documents', keywords: ['transcript', 'TOR', 'transcript of records', 'request document'] },
  },
  {
    source: 'CAS_Document_Requests',
    chunk_index: 1,
    content: 'Certificate of Enrollment: Available at the CAS Registrar Office. Processing takes 1 to 2 working days. Present your current registration form and a valid school ID. Free for the first copy; succeeding copies have a fee. This certifies that you are currently enrolled in CAS.',
    metadata: { category: 'documents', keywords: ['certificate of enrollment', 'COE', 'enrollment certificate', 'proof of enrollment'] },
  },
  {
    source: 'CAS_Document_Requests',
    chunk_index: 2,
    content: 'Certificate of Good Moral Character: Submit a request to the CAS Student Affairs Office with two 2x2 photos and a valid school ID. Processing takes 2 to 3 working days. This document is required for scholarship applications, employment, and transfer to other schools.',
    metadata: { category: 'documents', keywords: ['good moral', 'certificate of good moral', 'character reference'] },
  },
  {
    source: 'CAS_Document_Requests',
    chunk_index: 3,
    content: 'Honorable Dismissal: Students who wish to transfer to another school must request an Honorable Dismissal from the CAS Registrar. Clear all financial obligations first. Processing takes 5 to 7 working days. This document must be presented to the receiving school for transfer admission.',
    metadata: { category: 'documents', keywords: ['honorable dismissal', 'transfer', 'leave school'] },
  },

  // ── GRADUATION ──────────────────────────────────────────────
  {
    source: 'CAS_Graduation_Guide',
    chunk_index: 0,
    content: 'Graduation requirements for CAS: Students must complete all required units in their curriculum, have a GWA of at least 3.0, no incomplete or failing grades, cleared all financial obligations, and completed the required NSTP and PE units. File a graduation application one semester before your expected graduation.',
    metadata: { category: 'graduation', keywords: ['graduation', 'graduate', 'requirements', 'clearance', 'finish'] },
  },
  {
    source: 'CAS_Graduation_Guide',
    chunk_index: 1,
    content: 'Latin honors in CAS: Summa Cum Laude requires a GWA of 1.20 or higher. Magna Cum Laude requires 1.21 to 1.45. Cum Laude requires 1.46 to 1.75. No failing grades, no grade below 2.0, and no disciplinary action on record are required for all honors.',
    metadata: { category: 'graduation', keywords: ['latin honors', 'summa cum laude', 'magna cum laude', 'cum laude', 'honors'] },
  },

  // ── OFFICE INFORMATION ──────────────────────────────────────
  {
    source: 'CAS_Office_Info',
    chunk_index: 0,
    content: 'CAS Dean\'s Office hours: Monday to Friday, 8:00 AM to 5:00 PM. Closed on weekends and holidays. Location: CAS Building, 2nd Floor. For urgent concerns outside office hours, email cas.dean@neu.edu.ph or call the main NEU trunk line and ask for CAS.',
    metadata: { category: 'office', keywords: ['office hours', 'CAS office', 'dean office', 'contact', 'open'] },
  },
  {
    source: 'CAS_Office_Info',
    chunk_index: 1,
    content: 'CAS Registrar Office: Located at CAS Building, Ground Floor. Open Monday to Friday, 8:00 AM to 4:30 PM. Handles enrollment, grade records, document requests, and student records. Bring a valid school ID for all transactions.',
    metadata: { category: 'office', keywords: ['registrar', 'CAS registrar', 'records', 'student records'] },
  },
  {
    source: 'CAS_Office_Info',
    chunk_index: 2,
    content: 'CAS Student Affairs Office: Located at CAS Building, 2nd Floor beside the Dean\'s Office. Handles scholarships, student organizations, extracurricular activities, disciplinary cases, and good moral certificates. Open Monday to Friday, 8:00 AM to 5:00 PM.',
    metadata: { category: 'office', keywords: ['student affairs', 'organization', 'extracurricular', 'discipline'] },
  },

  // ── DEPARTMENTS ─────────────────────────────────────────────
  {
    source: 'CAS_Programs',
    chunk_index: 0,
    content: 'CAS programs and departments: The College of Arts and Sciences offers programs in BS Psychology, BS Biology, BS Mathematics, AB Communication, AB Political Science, AB Sociology, and BS Statistics. Each program has a dedicated department chair and faculty adviser for student concerns.',
    metadata: { category: 'programs', keywords: ['program', 'department', 'course', 'BS', 'AB', 'psychology', 'biology', 'math', 'communication'] },
  },
  {
    source: 'CAS_Programs',
    chunk_index: 1,
    content: 'Seeing your academic adviser: Each CAS student is assigned an academic adviser from their department. Consultation is required at the start of every semester before enrollment. Your adviser checks your curriculum compliance, recommends subjects, and assists with academic concerns.',
    metadata: { category: 'advising', keywords: ['adviser', 'academic adviser', 'consultation', 'advising', 'curriculum'] },
  },

  // ── COMMON CONCERNS ─────────────────────────────────────────
  {
    source: 'CAS_FAQ',
    chunk_index: 0,
    content: 'How to get a copy of your curriculum checklist: Request a curriculum checklist from your Department Secretary or download it from the NEU student portal under the CAS section. Verify with your academic adviser that all completed subjects are properly checked off.',
    metadata: { category: 'curriculum', keywords: ['curriculum', 'checklist', 'subjects required', 'units required'] },
  },
  {
    source: 'CAS_FAQ',
    chunk_index: 1,
    content: 'Missing grade or grade not yet posted: If your grade has not appeared in the student portal after two weeks from the end of the semester, submit a Grade Inquiry Form to the CAS Registrar. The Registrar will coordinate with your professor to verify and post the grade.',
    metadata: { category: 'grades', keywords: ['missing grade', 'grade not posted', 'no grade', 'grade inquiry'] },
  },
  {
    source: 'CAS_FAQ',
    chunk_index: 2,
    content: 'Student clearance procedure: Before the end of each semester, students must secure clearance from the library, laboratory, and finance office. Submit the completed clearance form to the CAS Registrar to process your next enrollment or graduation.',
    metadata: { category: 'clearance', keywords: ['clearance', 'student clearance', 'library clearance', 'lab clearance'] },
  },
  {
    source: 'CAS_FAQ',
    chunk_index: 3,
    content: 'Lost school ID: Report a lost school ID immediately to the NEU Security Office and the CAS Registrar. Pay the replacement fee at the cashier and present the official receipt to the Registrar. Replacement ID processing takes 3 to 5 working days.',
    metadata: { category: 'id', keywords: ['lost ID', 'school ID', 'replace ID', 'ID replacement'] },
  },
  {
    source: 'CAS_FAQ',
    chunk_index: 4,
    content: 'Leave of absence: Students who need to temporarily stop studying must file a Leave of Absence (LOA) at the CAS Dean\'s Office before the semester ends. Maximum LOA is two consecutive semesters. Failure to file LOA before leaving may result in automatic dropping from the program.',
    metadata: { category: 'leave', keywords: ['leave of absence', 'LOA', 'stop studying', 'stop school', 'temporary leave'] },
  },
];

// ── Seeder ────────────────────────────────────────────────────

async function embedText(text) {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

async function seed() {
  console.log(`\n🚀  CAS-Assist Knowledge Base Seeder`);
  console.log(`    Seeding ${KNOWLEDGE_BASE.length} entries...\n`);

  let success = 0;
  let failed  = 0;

  for (const entry of KNOWLEDGE_BASE) {
    try {
      process.stdout.write(`  Embedding: ${entry.source} chunk ${entry.chunk_index}... `);

      const embedding = await embedText(entry.content);

      const { error } = await supabase
        .from('handbook_knowledge_embeddings')
        .upsert(
          {
            source_document: entry.source,
            chunk_index:     entry.chunk_index,
            content:         entry.content,
            embedding,
            metadata:        entry.metadata,
            state:           'active',
          },
          { onConflict: 'source_document,chunk_index' },
        );

      if (error) throw error;

      console.log('✓');
      success++;

      // Respect OpenAI rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log(`✗  ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅  Done: ${success} seeded, ${failed} failed.\n`);
}

seed().catch(console.error);
