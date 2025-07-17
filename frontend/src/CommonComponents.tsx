// frontend/src/CommonComponents.tsx
import React from 'react';

export const LoadingSpinner: React.FC = () => (
    <div className="d-flex justify-content-center">
        <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
        </div>
    </div>
);

export const MessageDisplay: React.FC<{ message: { text: string; type: 'success' | 'error' | 'warning' | '' } }> = ({ message }) => {
    if (!message?.text) return null;
    return (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'} text-center mt-3`}>
            {message.text}
        </div>
    );
};

interface CustomModalProps {
    title: string;
    message: string | React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    children?: React.ReactNode;
}

export const CustomModal: React.FC<CustomModalProps> = ({
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    children
}) => {
    return (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content rounded-3 shadow-lg">
                    <div className="modal-header bg-primary text-white rounded-top-3">
                        <h5 className="modal-title">{title}</h5>
                        <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onCancel}></button>
                    </div>
                    <div className="modal-body p-4">
                        {typeof message === 'string' ? <p>{message}</p> : message}
                        {children}
                    </div>
                    <div className="modal-footer justify-content-center border-top-0 p-4">
                        <button type="button" className="btn btn-secondary me-2" onClick={onCancel}>{cancelText}</button>
                        <button type="button" className="btn btn-primary" onClick={onConfirm}>{confirmText}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
