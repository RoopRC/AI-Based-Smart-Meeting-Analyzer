'use client';

import { useState, useRef, useEffect } from 'react';
import { uploadAudioFile, downloadReport, AlignedTranscript } from '@/lib/api';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import BackendStatus from '@/components/BackendStatus';
import { jsPDF } from 'jspdf';

interface Speaker {
  id: number;
  name: string;
  color: string;
}

const TranscriptionPage = () => {
  // State management
  const [file, setFile] = useState<File | null>(null);
  const [transcriptData, setTranscriptData] = useState<AlignedTranscript[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Ready to upload audio or video file');
  const [progress, setProgress] = useState(0);
  const [isUploadHovered, setIsUploadHovered] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('Meeting');

  // Refs
  const uploadAreaRef = useRef<HTMLLabelElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Backend health check
  const { isHealthy } = useBackendHealth();

  // Speaker list for UI
  const speakers: Speaker[] = [
    { id: 1, name: 'Speaker 1', color: '#3b82f6' },
    { id: 2, name: 'Speaker 2', color: '#60a5fa' },
    { id: 3, name: 'Speaker 3', color: '#93c5fd' },
    { id: 4, name: 'Speaker 4', color: '#bfdbfe' },
  ];

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Get speaker name from label
  const getSpeakerName = (speakerLabel: string) => {
    const match = speakerLabel?.match(/SPEAKER_(\d+)/);
    if (match) {
      const idx = parseInt(match[1], 10);
      return speakers[idx % speakers.length]?.name || `Speaker ${idx}`;
    }
    return speakerLabel || 'Unknown';
  };

  // Handle file upload and transcription
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const f = e.target.files[0];

    // Validate file type
    if (!f.type.startsWith('audio/') && !f.type.startsWith('video/')) {
      setStatus('❌ Please upload an audio or video file');
      return;
    }

    setFile(f);
    setTranscriptData([]);
    setSummary('');
    setProgress(0);
    setStatus('Uploading file...');

    if (!isHealthy) {
      setStatus('❌ Backend is not connected. Please start the backend server.');
      return;
    }

    try {
      setIsProcessing(true);
      setProgress(20);
      setStatus('Uploading and transcribing...');

      const result = await uploadAudioFile(f);

      setProgress(70);
      setTranscriptData(result.aligned_transcript || []);

      // Handle summary - could be string or object
      if (typeof result.summary === 'string') {
        setSummary(result.summary);
      } else if (typeof result.summary === 'object') {
        setSummary(JSON.stringify(result.summary, null, 2));
      }

      setProgress(100);
      setStatus('✅ Transcription completed successfully!');
    } catch (error: any) {
      setStatus(`❌ Error: ${error?.message || 'Transcription failed'}`);
      console.error('Upload error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download as PDF
  const handleDownloadPDF = async () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(26, 42, 108);
      doc.text(meetingTitle, 105, 18, { align: 'center' });

      // Date
      const date = new Date().toLocaleString();
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${date}`, 15, 28);

      // Transcript section
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      let y = 40;
      doc.text('Transcript:', 15, y);
      y += 8;
      doc.setFontSize(10);

      transcriptData.forEach((line) => {
        const speakerName = getSpeakerName(line.speaker);
        const time = formatTime(line.start);
        const text = `${time} ${speakerName}: ${line.text}`;
        const split = doc.splitTextToSize(text, 180);

        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.text(split, 15, y);
        y += split.length * 6.5;
      });

      // Summary section
      if (y > 250) {
        doc.addPage();
        y = 20;
      } else {
        y += 8;
      }

      doc.setFontSize(14);
      doc.text('Summary:', 15, y);
      y += 8;
      doc.setFontSize(11);

      const summaryLines = (summary || '').split('\n').filter((line) => line.trim());
      summaryLines.forEach((line) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const split = doc.splitTextToSize(line, 180);
        doc.text(split, 20, y);
        y += split.length * 6.5;
      });

      doc.save(`${meetingTitle}_transcription.pdf`);
    } catch (error) {
      console.error('PDF download error:', error);
      setStatus('❌ Error generating PDF');
    }
  };

  // Download as TXT
  const handleDownloadTXT = () => {
    try {
      const transcriptText = transcriptData
        .map((line) => {
          const speakerName = getSpeakerName(line.speaker);
          const time = formatTime(line.start);
          return `${time} ${speakerName}: ${line.text}`;
        })
        .join('\n');

      const content = `Meeting: ${meetingTitle}
Date: ${new Date().toLocaleString()}

TRANSCRIPT:
${transcriptText}

SUMMARY:
${summary}`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meetingTitle}_transcription.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('TXT download error:', error);
      setStatus('❌ Error generating TXT');
    }
  };

  // Download as Word/DOCX using backend
  const handleDownloadDocx = async () => {
    try {
      setStatus('Generating Word document...');

      const reportReq = {
        file_format: 'docx' as const,
        meeting_title: meetingTitle,
        aligned_transcript: transcriptData,
        summary: summary,
      };

      const blob = await downloadReport(reportReq);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meetingTitle}_transcription.docx`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus('✅ Document downloaded successfully!');
    } catch (error: any) {
      console.error('DOCX download error:', error);
      setStatus(`❌ Error: ${error?.message || 'Failed to download document'}`);
    }
  };

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcriptData]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>

      <div className="w-full max-w-4xl bg-gradient-to-b from-blue-950/40 to-black/70 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-blue-800/30 relative z-10">
        {/* Header */}
        <div className="relative px-8 py-6 overflow-hidden border-b border-blue-800/30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-black/70"></div>
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-4xl font-bold text-blue-400 flex items-center justify-center relative mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-blue-400 mr-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Meeting Transcription
            </h1>
            <p className="text-blue-200/80 mt-2">
              Upload audio/video → Get AI transcript with speaker diarization & summary
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 relative">
          {/* Backend Status */}
          <BackendStatus />

          {/* Meeting Title Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-blue-300 mb-2">Meeting Title</label>
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Enter meeting title..."
              className="w-full px-4 py-2 bg-blue-900/30 border border-blue-800/50 rounded-lg text-white placeholder-blue-400/50 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Upload Area */}
          <label
            ref={uploadAreaRef}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-500 cursor-pointer bg-gradient-to-br from-blue-900/20 to-black/50 backdrop-blur-sm relative overflow-hidden ${isUploadHovered
                ? 'border-blue-500 shadow-lg scale-[1.02] bg-blue-900/30'
                : 'border-blue-700/50'
              }`}
            onMouseEnter={() => setIsUploadHovered(true)}
            onMouseLeave={() => setIsUploadHovered(false)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 transition-opacity duration-500 hover:opacity-100"></div>

            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              disabled={isProcessing || !isHealthy}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-5 relative z-10">
              <div className="relative">
                <div
                  className={`absolute inset-0 bg-blue-500/30 rounded-full blur-lg transition-all duration-500 ${isUploadHovered ? 'scale-125 opacity-50' : 'scale-100 opacity-0'
                    }`}
                ></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-14 w-14 text-blue-400 relative z-10 transition-transform duration-500 hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <div className="space-y-2">
                <p className="text-blue-200 text-lg font-medium">
                  {isProcessing ? 'Processing...' : 'Drag & drop your file here'}
                </p>
                <p className="text-blue-500 text-sm">or</p>
              </div>

              <span
                className={`px-6 py-3 ${isProcessing || !isHealthy
                    ? 'bg-blue-800 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-105'
                  } text-white rounded-xl font-medium transition-all duration-300 transform shadow-lg shadow-blue-500/20`}
              >
                {isProcessing ? 'Uploading...' : 'Browse Files'}
              </span>

              <p className="text-blue-500 text-sm">Supports MP3, WAV, MP4 and more</p>
            </div>
          </label>

          {/* Progress Bar */}
          {file && (
            <div className="mt-8">
              <div className="w-full bg-blue-900/30 backdrop-blur-sm rounded-full h-3 shadow-inner overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20"></div>
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent"></div>
                </div>
              </div>
              <p
                className={`text-sm mt-3 text-center font-medium ${status.includes('❌')
                    ? 'text-red-400'
                    : status.includes('✅')
                      ? 'text-green-400'
                      : 'text-blue-300'
                  }`}
              >
                {status}
              </p>
            </div>
          )}

          {/* Transcript + Summary */}
          {file && transcriptData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
              {/* Transcript */}
              <div className="bg-blue-900/20 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-800/30 relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-28 h-28 bg-blue-500/10 rounded-full"></div>
                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-indigo-500/10 rounded-full"></div>

                <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center justify-center relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 relative text-blue-400 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Transcript ({transcriptData.length} segments)
                </h2>

                {/* Speaker Legend */}
                <div className="mb-3 flex flex-wrap gap-2 justify-center">
                  {speakers.slice(0, 4).map((s) => (
                    <span
                      key={s.id}
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: s.color + '22', color: s.color }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>

                <div
                  ref={transcriptContainerRef}
                  className="h-80 overflow-y-auto text-blue-100 bg-black/40 backdrop-blur rounded-xl p-4 border border-blue-800/30 scrollbar-thin scrollbar-thumb-blue-700 scrollbar-track-transparent relative"
                >
                  <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-blue-900/70 to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-blue-900/70 to-transparent pointer-events-none"></div>

                  {transcriptData.map((line, idx) => {
                    const speakerName = getSpeakerName(line.speaker);
                    const speakerIdx = parseInt(line.speaker?.match(/\d+/)?.[0] || '0', 10);
                    const speakerColor = speakers[speakerIdx % speakers.length]?.color || '#3b82f6';

                    return (
                      <div
                        key={idx}
                        className="transcript-line mb-4 p-3 rounded-lg bg-blue-900/30 hover:bg-blue-900/40 transition-all duration-300"
                      >
                        <div className="flex items-start">
                          <span className="text-blue-600 text-xs mt-1 mr-2 flex-shrink-0">
                            {formatTime(line.start)}
                          </span>
                          <span
                            className="font-medium flex-shrink-0"
                            style={{ color: speakerColor }}
                          >
                            {speakerName}:
                          </span>
                          <span className="ml-2">{line.text}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-900/20 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-800/30 relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-28 h-28 bg-indigo-500/10 rounded-full"></div>
                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-purple-500/10 rounded-full"></div>

                <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center justify-center relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 relative text-indigo-400 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  AI Summary
                </h2>

                <div className="h-80 overflow-y-auto text-blue-100 bg-black/40 backdrop-blur rounded-xl p-5 border border-blue-800/30 whitespace-pre-wrap scrollbar-thin scrollbar-thumb-indigo-700 scrollbar-track-transparent relative">
                  <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-blue-900/70 to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-blue-900/70 to-transparent pointer-events-none"></div>

                  {summary || 'No summary available'}
                </div>
              </div>
            </div>
          )}

          {/* Download Buttons */}
          {file && transcriptData.length > 0 && (
            <div className="flex gap-4 mt-8 justify-center flex-wrap">
              <button
                onClick={handleDownloadPDF}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 flex items-center justify-center relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/10 group-hover:bg-white/5 transition-all duration-300"></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download PDF
              </button>

              <button
                onClick={handleDownloadTXT}
                className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-300 flex items-center justify-center relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/10 group-hover:bg-white/5 transition-all duration-300"></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download TXT
              </button>

              <button
                onClick={handleDownloadDocx}
                className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/10 group-hover:bg-white/5 transition-all duration-300"></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Download DOCX
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionPage;
