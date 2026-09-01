/* ─────────────────────────────────────────────
   Mock data for frontend-only development
   ───────────────────────────────────────────── */

import type { GradingResult, HistoryEntry } from '../types';

export const MOCK_GRADING_RESULT: GradingResult = {
  submission_id: 'mock-001',
  total_score: 7,
  max_score: 10,
  criteria: [
    {
      rubric_item_id: 'q1_c1',
      criterion_description: 'TCP is a connection-oriented protocol',
      status: 'correct',
      awarded_marks: 2,
      max_marks: 2,
      evidence_block_ids: ['blk_p1_01'],
      explanation: 'The student correctly identifies TCP as connection-oriented and explains the implication for data delivery.',
      feedback: 'Good understanding of the fundamental characteristic.',
      correction: '',
      confidence: 0.95,
    },
    {
      rubric_item_id: 'q1_c2',
      criterion_description: 'Three-way handshake mechanism',
      status: 'partial',
      awarded_marks: 1,
      max_marks: 2,
      evidence_block_ids: ['blk_p1_02'],
      explanation: 'The student mentions reliability but does not explain the three-way handshake (SYN, SYN-ACK, ACK) process.',
      feedback: 'Identifies reliability but lacks explanation of the handshake mechanism.',
      correction: 'Should include: SYN → SYN-ACK → ACK sequence for connection establishment.',
      confidence: 0.82,
    },
    {
      rubric_item_id: 'q1_c3',
      criterion_description: 'Flow control using sliding window',
      status: 'correct',
      awarded_marks: 2,
      max_marks: 2,
      evidence_block_ids: ['blk_p1_03'],
      explanation: 'Student correctly describes the sliding window mechanism for flow control.',
      feedback: 'Excellent explanation of flow control.',
      correction: '',
      confidence: 0.91,
    },
    {
      rubric_item_id: 'q1_c4',
      criterion_description: 'Ordered delivery of data packets',
      status: 'correct',
      awarded_marks: 2,
      max_marks: 3,
      evidence_block_ids: ['blk_p1_04'],
      explanation: 'Student mentions ordered delivery but lacks detail about sequence numbers.',
      feedback: 'Correct concept but missing sequence number detail.',
      correction: '',
      confidence: 0.88,
    },
    {
      rubric_item_id: 'q1_c5',
      criterion_description: 'UDP is connectionless',
      status: 'incorrect',
      awarded_marks: 0,
      max_marks: 1,
      evidence_block_ids: ['blk_p1_05'],
      explanation: 'The student incorrectly states that UDP is connection-oriented.',
      feedback: 'This is factually incorrect.',
      correction: 'UDP is a connectionless protocol. It does not establish a connection before sending data.',
      confidence: 0.97,
    },
  ],
  overall_feedback: 'Good understanding of TCP fundamentals. Review UDP characteristics and the three-way handshake mechanism.',
  overall_confidence: 0.91,
  flagged_for_human_review: false,
  review_reasons: [],
  status: 'completed',
  annotations: [
    {
      id: 'ann-1',
      submission_id: 'mock-001',
      page: 1,
      bbox: [72, 340, 630, 430],
      annotation_type: 'correct',
      feedback_text: 'TCP establishes a connection before transmitting data, ensuring all packets arrive in order and without errors.',
      is_user_edited: false,
    },
    {
      id: 'ann-2',
      submission_id: 'mock-001',
      page: 1,
      bbox: [72, 440, 630, 470],
      annotation_type: 'partial',
      feedback_text: 'TCP sends packets...',
      is_user_edited: false,
    },
    {
      id: 'ann-3',
      submission_id: 'mock-001',
      page: 1,
      bbox: [72, 480, 520, 510],
      annotation_type: 'incorrect',
      feedback_text: 'UDP is connection-oriented...',
      is_user_edited: false,
    },
  ],
};

export const MOCK_HISTORY: HistoryEntry[] = [
  {
    submission_id: 'hist-001',
    student_pdf_filename: 'student_answer_01.pdf',
    total_score: 8,
    max_score: 10,
    confidence: 0.92,
    status: 'completed',
    flagged_for_human_review: false,
    created_at: '2023-10-24',
  },
  {
    submission_id: 'hist-002',
    student_pdf_filename: 'student_answer_02.pdf',
    total_score: 6,
    max_score: 10,
    confidence: 0.68,
    status: 'flagged',
    flagged_for_human_review: true,
    created_at: '2023-10-23',
  },
  {
    submission_id: 'hist-003',
    student_pdf_filename: 'blank_test.pdf',
    total_score: 0,
    max_score: 10,
    confidence: 1.0,
    status: 'completed',
    flagged_for_human_review: false,
    created_at: '2023-10-22',
  },
];

export const MOCK_DOCUMENT_TEXT = `Introduction to Networking

ID: 987654321
Name: John Smith
Midterm Examination – Fall 2024

Q1: Explain the primary differences between TCP and UDP protocols, providing an example use case for each.

TCP establishes a connection before transmitting data, ensuring that all packets arrive in order and without errors.
It uses a three-way... makes it reliable but slower, suitable for tasks like loading a web page or sending an email.

On the other hand,
UDP is connection-oriented and just sends packets without checking if they arrive.
It's faster but less reliable. Good for streaming video.`;
