import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '../db/settings';

export const DISCLAIMER_TEXT =
  '본 앱은 개인 참고용 보조 도구이며, 승인된 EFB·OFP·운항 매뉴얼을 대체하지 않습니다. 운항 판단은 공식 자료를 기준으로 합니다.';

/** 첫 실행 고지 (SPEC §16) */
export function Disclaimer() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    void getSetting('disclaimerAckAt').then((v) => setShow(!v));
  }, []);

  if (!show) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="disc-title">
      <div className="modal">
        <h2 id="disc-title">고지</h2>
        <p>{DISCLAIMER_TEXT}</p>
        <button
          className="btn primary"
          onClick={async () => {
            await setSetting('disclaimerAckAt', new Date().toISOString());
            setShow(false);
          }}
        >
          확인했습니다
        </button>
      </div>
    </div>
  );
}
