import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageUploaderProps {
  onImageUpload: (file: File, url: string) => void;
  className?: string;
  translations: {
    drop: string;
    idle: string;
    hint: string;
    error: string;
  };
}

export function ImageUploader({ onImageUpload, className, translations }: ImageUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > 10 * 1024 * 1024) {
        alert(translations.error);
        return;
      }
      const url = URL.createObjectURL(file);
      onImageUpload(file, url);
    }
  }, [onImageUpload, translations.error]);

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
        'border-2 border-dashed rounded-xl p-6 sm:p-12 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50',
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <UploadCloud className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
        <div>
          <p className="text-base sm:text-lg font-medium text-gray-700">
            {isDragActive ? translations.drop : translations.idle}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {translations.hint}
          </p>
        </div>
      </div>
    </div>
  );
}
