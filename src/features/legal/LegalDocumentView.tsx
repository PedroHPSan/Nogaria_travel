import React from 'react';
import { LEGAL_IS_DRAFT, LEGAL_VERSION, type LegalDocument } from './legalTexts';

/** Renderização de um documento legal (política ou termos), usada no modal e na tela de aceite. */
export const LegalDocumentView: React.FC<{ document: LegalDocument }> = ({ document }) => (
  <article className="space-y-4 text-xs text-ink-300 leading-relaxed">
    <div className="text-[11px] text-ink-500">
      Versão {LEGAL_VERSION} • atualizada em {document.updatedAt}
    </div>
    {LEGAL_IS_DRAFT && (
      <div className="px-3 py-2 rounded-xl bg-warning-500/10 border border-warning-500/30 text-warning-300 text-[11px]">
        Este texto está em revisão jurídica. Os campos entre colchetes serão preenchidos antes da versão final.
      </div>
    )}
    {document.sections.map(section => (
      <section key={section.title} className="space-y-1.5">
        <h3 className="text-sm font-bold text-ink-100">{section.title}</h3>
        {section.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>
    ))}
  </article>
);
