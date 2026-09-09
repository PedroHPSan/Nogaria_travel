import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { LegalDocumentView } from '../../features/legal/LegalDocumentView';
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDocument } from '../../features/legal/legalTexts';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDocument?: LegalDocument['id'];
}

/** Política de privacidade e termos de uso, acessíveis antes e depois do login. */
export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, initialDocument = 'privacy' }) => {
  const [active, setActive] = useState<LegalDocument['id']>(initialDocument);
  const doc = active === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={doc.title}>
      <div className="flex rounded-xl bg-ink-900 border border-ink-800 p-1 mb-4">
        {[PRIVACY_POLICY, TERMS_OF_USE].map(d => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActive(d.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${active === d.id ? 'bg-info-600 text-white' : 'text-ink-400'}`}
          >
            {d.title}
          </button>
        ))}
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <LegalDocumentView document={doc} />
      </div>
    </BaseModal>
  );
};
