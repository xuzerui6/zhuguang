import { LEGAL_DOCUMENTS, type LegalDocument } from '../../shared/legal-documents';

export async function loadLegalDocuments(): Promise<LegalDocument[]> {
  const origin = (process.env.ZHUGUANG_MOBILE_API_URL || 'https://api.beijingzhuguang.top').replace(/\/$/u, '');
  try {
    const response = await fetch(`${origin}/api/v1/public/legal-documents`, { cache: 'no-store', signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return LEGAL_DOCUMENTS;
    const envelope = await response.json() as { data?: LegalDocument[] };
    if (!Array.isArray(envelope.data)) return LEGAL_DOCUMENTS;
    return LEGAL_DOCUMENTS.map(baseline => envelope.data?.find(item => item.slug === baseline.slug && typeof item.body === 'string' && item.body.length > 0) || baseline);
  } catch { return LEGAL_DOCUMENTS; }
}
