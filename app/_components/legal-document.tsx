import type { LegalDocument } from '../../shared/legal-documents';
import styles from './public-pages.module.css';

export function LegalDocumentBody({ document }: { document: LegalDocument }) {
  return <section className={styles.guaranteeBand}>
    <div><h2>{document.title}</h2><p>版本：{document.version}</p></div>
    <div className={styles.guaranteeCopy}>{document.body.split(/\n\s*\n/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
  </section>;
}
