// MessageInput.tsx
'use client';

import { useState, KeyboardEvent, ChangeEvent, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, X } from 'lucide-react';

interface MessageInputProps {
  onSend: (text: string, file?: File | null) => Promise<boolean>;
}

export default function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !file) || sending) return;

    try {
      setSending(true);
      const success = await onSend(message, file);
      if (success) {
        setMessage('');
        removeFile();
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getFilePreview = () => {
    if (!file) return null;
    if (!previewUrl) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return file.type.startsWith('image/') ? <img src={url} alt="preview" className="max-h-20 rounded" height={55} /> : <span className="text-sm text-gray-600">{file.name}</span>;
    }
    if (file.type.startsWith('image/')) {
      return <img src={previewUrl} alt="preview" className="max-h-20 rounded" height={55} />;
    }
    return <span className="text-sm text-gray-600">{file.name}</span>;
  };

  return (
    <>
      {file && (
        <div className="card attachment-card p-2 d-flex">
          <div className='d-flex align-items-start'>
            <div className='flex-grow-1'>
              {getFilePreview()}
            </div>
            <a href='#' onClick={removeFile} className="fw-medium">
              <i className="ri-close-fill"></i>
            </a>
          </div>
        </div>
      )}
      <div className="row g-0">
        <div className="col">
          <input 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            // onKeyDown={handleKeyDown}
            type="text" 
            className="form-control form-control-lg bg-light border-light" 
            placeholder="Enter Message..." />
        </div>
        <div className="col-auto">
          <div className="chat-input-links ms-md-2 me-md-0">
            <ul className="list-inline mb-0">
              <li className="list-inline-item" data-bs-toggle="tooltip" data-bs-placement="top" title="Attached File">
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-link text-decoration-none font-size-16 btn-lg waves-effect">
                  <i className="ri-attachment-line" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="d-none"
                  accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                />
              </li>
              <li className="list-inline-item">
                <button type="submit" onClick={handleSend} className="btn btn-primary font-size-16 btn-lg chat-send waves-effect waves-light">
                  <i className="ri-send-plane-2-fill" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}