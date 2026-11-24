// Backend API service for transcription and report generation
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface AlignedTranscript {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResponse {
  message: string;
  aligned_transcript: AlignedTranscript[];
  summary: string | Record<string, any>;
}

export interface ReportRequest {
  file_format: 'pdf' | 'docx' | 'md';
  meeting_title: string;
  aligned_transcript: AlignedTranscript[];
  summary: string | Record<string, any>;
  file_name?: string;
}

/**
 * Upload audio file for transcription, diarization, and summarization
 */
export async function uploadAudioFile(file: File): Promise<TranscriptionResponse> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data: TranscriptionResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading audio file:', error);
    throw error;
  }
}

/**
 * Generate and download report (PDF, DOCX, or Markdown)
 */
export async function downloadReport(request: ReportRequest): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}/download_report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Report generation failed: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('Error downloading report:', error);
    throw error;
  }
}

/**
 * Check if backend is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}
