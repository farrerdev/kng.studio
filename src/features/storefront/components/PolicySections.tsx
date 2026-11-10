import { X } from "lucide-react";
import { POLICY_SECTIONS } from "../policies";

type PolicySectionsProps = {
  className: string;
  includeIds?: boolean;
};

export function PolicySections({ className, includeIds = false }: PolicySectionsProps) {
  return (
    <section className={className} id={includeIds ? "policy" : undefined} aria-label="Quy định mua hàng">
      {POLICY_SECTIONS.map((section) => (
        <article id={includeIds ? section.id : undefined} key={section.id}>
          <h3>{section.title}</h3>
          {section.items ? (
            <>
              {section.intro ? <p>{section.intro}</p> : null}
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{section.body}</p>
          )}
        </article>
      ))}
    </section>
  );
}

export function PolicyAccordion() {
  return (
    <section className="shop-policy-accordion" aria-label="Quy định mua hàng">
      <h3>Trước khi đặt hàng</h3>
      {POLICY_SECTIONS.map((section) => (
        <details key={section.id}>
          <summary>{section.title}</summary>
          {section.items ? (
            <>
              {section.intro ? <p>{section.intro}</p> : null}
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{section.body}</p>
          )}
        </details>
      ))}
    </section>
  );
}

type PolicyModalProps = {
  onClose: () => void;
};

export function PolicyModal({ onClose }: PolicyModalProps) {
  return (
    <div className="policy-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="policy-modal-title" onClick={onClose}>
      <section className="policy-modal-panel" onClick={(event) => event.stopPropagation()}>
        <header className="policy-modal-header">
          <div>
            <span>Trước khi mua</span>
            <h2 id="policy-modal-title">Quy định mua hàng</h2>
          </div>
          <button type="button" aria-label="Đóng quy định mua hàng" onClick={onClose}>
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <PolicySections className="policy-modal-sections" />
      </section>
    </div>
  );
}
