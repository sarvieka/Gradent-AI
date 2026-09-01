import { useCallback, useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import type { UploadedFile } from '../../types';

interface Props {
  label: string;
  hint: string;
  accept: string;
  file: UploadedFile | null;
  onFileSelect: (f: UploadedFile | null) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadCard({ label, hint, accept, file, onFileSelect }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    onFileSelect({ file: f, name: f.name, size: f.size });
  }, [onFileSelect]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (file) {
    return (
      <div className="upload-card">
        <div className="upload-card-label">{label}</div>
        <div className="upload-card-hint">{hint}</div>
        <div className="upload-file-selected">
          <div className="upload-file-icon">
            <FileUp size={18} />
          </div>
          <div className="upload-file-info">
            <div className="upload-file-name">{file.name}</div>
            <div className="upload-file-size">{formatSize(file.size)}</div>
          </div>
          <button
            className="upload-file-remove"
            onClick={() => onFileSelect(null)}
            aria-label="Remove file"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-card">
      <div className="upload-card-label">{label}</div>
      <div className="upload-card-hint">{hint}</div>
      <div
        className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="upload-dropzone-icon">
          <FileUp size={22} />
        </div>
        <span className="upload-dropzone-text">Drag and drop file here</span>
        <span className="upload-dropzone-sub">or click to browse from your computer</span>
        <button
          className="upload-browse-btn"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        >
          Browse
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
