import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export const BottomSheet: React.FC<Props> = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="sheet-handle" />
        {children}
      </div>
    </>
  );
};
