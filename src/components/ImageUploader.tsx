import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageUploaderProps {
  onImageUpload: (file: File, url: string) => void;
  className?: string;
}

export function ImageUploader({ onImageUpload, className }: ImageUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > 10 * 1024 * 1024) {
        alert('Please upload an image smaller than 10MB.');
        return;
      }
      const url = URL.createObjectURL(file);
      onImageUpload(file, url);
    }
  }, [onImageUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': []
    },
    maxFiles: 1
  } as any);

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50',
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <UploadCloud className="w-12 h-12 text-gray-400" />
        <div>
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? 'Drop image here' : 'Drag & drop an image here'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            or click to select files (JPG, PNG, WebP up to 10MB)
          </p>
        </div>
      </div>
    </div>
  );
}
