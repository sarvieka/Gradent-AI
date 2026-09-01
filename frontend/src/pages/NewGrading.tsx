import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import ContentHeader from '../components/layout/ContentHeader';
import FileUploadCard from '../components/upload/FileUploadCard';
import GradingProgressModal from '../components/grading/GradingProgressModal';
import QuotaErrorCard from '../components/common/QuotaErrorCard';
import { submitGrading, isQuotaError, formatUserError } from '../services/api';
import type { UploadedFile, ProgressStage } from '../types';

const INITIAL_STAGES: ProgressStage[] = [
  {
    id: 'upload',
    label: 'Uploading files',
    description: 'Transferring student document & rubric to server…',
    status: 'pending',
  },
  {
    id: 'extract',
    label: 'Extracting answers',
    description: 'Running text & handwriting OCR extraction…',
    status: 'pending',
  },
  {
    id: 'evaluate',
    label: 'Evaluating against rubric',
    description: 'Calling Gemini AI for criterion evaluation…',
    status: 'pending',
    progress: 50,
  },
  {
    id: 'annotations',
    label: 'Preparing annotations',
    description: 'Resolving evidence & saving to database…',
    status: 'pending',
  },
];

export default function NewGrading() {
  const navigate = useNavigate();
  const [questionPaper, setQuestionPaper] = useState<UploadedFile | null>(null);
  const [studentAnswer, setStudentAnswer] = useState<UploadedFile | null>(null);
  const [rubric, setRubric] = useState<UploadedFile | null>(null);

  const [isGrading, setIsGrading] = useState(false);
  const [stages, setStages] = useState<ProgressStage[]>(INITIAL_STAGES);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFormComplete = Boolean(questionPaper && studentAnswer && rubric);

  const handleStartGrading = async () => {
    if (!isFormComplete || !studentAnswer || !questionPaper || !rubric) return;

    setErrorMessage(null);
    setIsQuotaExhausted(false);
    setIsGrading(true);
    setStages([
      { ...INITIAL_STAGES[0], status: 'active' },
      INITIAL_STAGES[1],
      INITIAL_STAGES[2],
      INITIAL_STAGES[3],
    ]);

    try {
      let rubricJson: string | null = null;
      let rubricFile: File | null = null;

      if (rubric.name.toLowerCase().endsWith('.json')) {
        rubricJson = await rubric.file.text();
      } else {
        rubricFile = rubric.file;
      }

      setStages([
        { ...INITIAL_STAGES[0], status: 'completed' },
        { ...INITIAL_STAGES[1], status: 'active' },
        INITIAL_STAGES[2],
        INITIAL_STAGES[3],
      ]);

      setTimeout(() => {
        setStages([
          { ...INITIAL_STAGES[0], status: 'completed' },
          { ...INITIAL_STAGES[1], status: 'completed' },
          { ...INITIAL_STAGES[2], status: 'active', progress: 75 },
          INITIAL_STAGES[3],
        ]);
      }, 800);

      // Call API with real Gemini grader
      const result = await submitGrading(
        studentAnswer.file,
        questionPaper.file,
        rubricFile,
        rubricJson,
        'gemini'
      );

      setStages([
        { ...INITIAL_STAGES[0], status: 'completed' },
        { ...INITIAL_STAGES[1], status: 'completed' },
        { ...INITIAL_STAGES[2], status: 'completed', progress: 100 },
        { ...INITIAL_STAGES[3], status: 'completed' },
      ]);

      setTimeout(() => {
        setIsGrading(false);
        navigate(`/review/${result.submission_id}`);
      }, 500);
    } catch (err: any) {
      // Log raw technical error for developer debugging
      console.error('Grading execution error:', err);

      setIsGrading(false);

      if (isQuotaError(err)) {
        setIsQuotaExhausted(true);
      } else {
        setErrorMessage(formatUserError(err));
      }
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <ContentHeader title="New Assessment" showSearch={false} />

        <div className="page-content">
          <h1 className="page-title">New Grading Submission</h1>
          <p className="page-subtitle">
            Upload the required documents to begin AI-assisted grading.
          </p>

          {/* Friendly Quota Error State with Retry Button */}
          {isQuotaExhausted && (
            <QuotaErrorCard onRetry={handleStartGrading} isRetrying={isGrading} />
          )}

          {/* Non-Quota General Error State */}
          {errorMessage && !isQuotaExhausted && (
            <div
              style={{
                margin: '20px 0 0',
                padding: '16px',
                background: 'var(--color-incorrect-bg)',
                border: '1px solid var(--color-incorrect-border)',
                borderRadius: 'var(--radius)',
                color: 'var(--color-incorrect)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '14px',
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          <div className="upload-section">
            <FileUploadCard
              label="Question Paper"
              hint="Upload the question paper (PDF, DOCX)"
              accept=".pdf,.docx,.doc"
              file={questionPaper}
              onFileSelect={setQuestionPaper}
            />

            <FileUploadCard
              label="Student Answer"
              hint="Upload the student's answer paper (PDF, Image)"
              accept=".pdf,.png,.jpg,.jpeg"
              file={studentAnswer}
              onFileSelect={setStudentAnswer}
            />

            <FileUploadCard
              label="Model Answer & Rubric"
              hint="Upload the model answer and marking rubric (PDF, DOCX, Text, JSON)"
              accept=".pdf,.docx,.doc,.txt,.json"
              file={rubric}
              onFileSelect={setRubric}
            />

            <div style={{ marginTop: 12 }}>
              <button
                className="btn-primary"
                disabled={!isFormComplete || isGrading}
                onClick={handleStartGrading}
              >
                {isGrading ? 'Grading in progress…' : 'Start Grading'}
                <ArrowRight size={18} />
              </button>
              <div className="security-note">
                <ShieldCheck size={14} />
                <span>Your data is analyzed securely using AI to provide evidence-based feedback.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isGrading && (
        <GradingProgressModal
          stages={stages}
          onCancel={() => setIsGrading(false)}
        />
      )}
    </div>
  );
}
