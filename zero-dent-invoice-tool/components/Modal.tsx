import React, { useEffect, useRef } from 'react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  titleId?: string;
  size?: 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  confirmText,
  onConfirm,
  cancelText = "Close",
  titleId = "modal-title",
  size = 'md',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const prevFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      prevFocusedElementRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus(); 

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
        if (event.key === 'Tab' && modalRef.current) {
            const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey) { 
              if (document.activeElement === firstElement) {
                lastElement.focus();
                event.preventDefault();
              }
            } else { 
              if (document.activeElement === lastElement) {
                firstElement.focus();
                event.preventDefault();
              }
            }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        prevFocusedElementRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-7xl',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1} 
      ref={modalRef}
    >
      <div className={`bg-app-surface p-6 rounded-lg shadow-xl w-full mx-4 border border-app-border ${sizeClasses[size]}`}>
        <div className="flex justify-between items-start">
            <h2 id={titleId} className="text-xl font-semibold mb-4 text-app-textPrimary">{title}</h2>
            <Button variant="secondary" onClick={onClose} className="!p-2 -mt-2 -mr-2" aria-label="Close modal">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </Button>
        </div>
        <div className="mb-6 text-app-textSecondary">{children}</div>
        { (onConfirm || !cancelText) &&
            <div className="flex justify-end space-x-3">
            { cancelText && <Button variant="outline" onClick={onClose}>{cancelText}</Button> }
            {onConfirm && confirmText && (
                <Button variant="primary" onClick={onConfirm}>
                {confirmText}
                </Button>
            )}
            </div>
        }
      </div>
    </div>
  );
};