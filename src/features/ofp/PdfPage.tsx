// OFP PDF 탭: PDF 가져오기 목록·자동 추출 결과·원문 뷰어 (OFP 탭에서 분리, Manual과 Settings 사이)
import { useEffect, useState } from 'react';
import { RawPdfView } from './RawPdfView';
import { useSourceJump } from './sourceJump';

export function PdfPage() {
  const [focus, setFocus] = useState<{ n: number; t: number } | null>(null);
  // 다른 탭(OFP 카드·NOTAM)에서 원문 위치 요청 → 그 줄로
  const pending = useSourceJump((s) => s.pending);
  useEffect(() => {
    if (!pending) return;
    setFocus(pending);
    useSourceJump.setState({ pending: null });
  }, [pending]);
  return <RawPdfView focus={focus} />;
}
