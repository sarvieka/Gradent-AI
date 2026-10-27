import type { GradingResult, HistoryEntry, Annotation } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** Check if an error represents a Gemini 429 RESOURCE_EXHAUSTED or quota limit error */
export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof ApiError) {
    if (err.status === 429) return true;
    const detail = (err.detail || '').toLowerCase();
    return (
      detail.includes('429') ||
      detail.includes('resource_exhausted') ||
      detail.includes('quota exceeded') ||
      detail.includes('rate limit') ||
      detail.includes('usage limit')
    );
  }
  if (err instanceof Error) {
    const msg = (err.message || '').toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota exceeded') ||
      msg.includes('rate limit') ||
      msg.includes('usage limit')
    );
  }
  return false;
}

/** Format non-quota errors into clean user-facing strings without exposing internal tech details */
export function formatUserError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return 'Unable to connect to the grading server. Please check your network connection.';
    }
    if (err.status >= 500) {
      return 'The grading service encountered an error. Please try again.';
    }
    return err.detail || 'Grading request failed. Please try again.';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred during grading.';
}

/** Submit a student paper for grading */
export async function submitGrading(
  studentPdf: File,
  questionPdf: File | null,
  rubricFile: File | null,
  rubricJson: string | null = null,
  graderType: 'gemini' | 'mock' = 'gemini'
): Promise<GradingResult> {
  const formData = new FormData();
  formData.append('student_pdf', studentPdf);

  if (questionPdf) {
    formData.append('question_pdf', questionPdf);
  }
  if (rubricFile) {
    formData.append('rubric_pdf', rubricFile);
  }
  if (rubricJson) {
    formData.append('rubric_json', rubricJson);
  }
  formData.append('grader_type', graderType);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/grading`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to FastAPI backend server at http://127.0.0.1:8000');
  }

  if (!response.ok) {
    let errorDetail = 'Grading failed';
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      errorDetail = await response.text();
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

/** Fetch a grading result by submission ID */
export async function getGradingResult(submissionId: string): Promise<GradingResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/grading/${submissionId}`, {
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to FastAPI backend server at http://127.0.0.1:8000');
  }

  if (!response.ok) {
    let errorDetail = 'Failed to retrieve grading result';
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      errorDetail = await response.text();
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

/** Fetch grading history */
export async function getHistory(): Promise<HistoryEntry[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/history`, {
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to FastAPI backend server at http://127.0.0.1:8000');
  }

  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to fetch history');
  }

  return response.json();
}

/** Finalize and persist a review as completed */
export async function completeReview(submissionId: string): Promise<GradingResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/grading/${submissionId}/complete`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to grading server');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: 'Failed to complete review' }));
    throw new ApiError(response.status, errData.detail);
  }

  return response.json();
}

/** Create a new teacher annotation on a submission */
export async function createAnnotation(
  submissionId: string,
  data: { page: number; bbox: [number, number, number, number]; annotation_type: string; feedback_text: string }
): Promise<Annotation> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/annotations/${submissionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to grading server');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: 'Failed to create annotation' }));
    throw new ApiError(response.status, errData.detail);
  }

  return response.json();
}

/** Update an existing annotation */
export async function updateAnnotation(
  annotationId: string,
  update: { page?: number; bbox?: [number, number, number, number]; annotation_type?: string; feedback_text?: string }
): Promise<Annotation> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/annotations/${annotationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(update),
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to grading server');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: 'Failed to update annotation' }));
    throw new ApiError(response.status, errData.detail);
  }

  return response.json();
}

/** Delete an annotation */
export async function deleteAnnotation(annotationId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/annotations/${annotationId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to grading server');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ detail: 'Failed to delete annotation' }));
    throw new ApiError(response.status, errData.detail);
  }
}
