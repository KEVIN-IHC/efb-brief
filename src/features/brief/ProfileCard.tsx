// Settings → 내 운항 조건 (D-053): Low Time·수습·부기장 Low Time·엔진 부작동 CAT III 확인. 기기 안에만
import { useEffect, useState } from 'react';
import { DEFAULT_PROFILE, loadProfile, saveProfile, type CrewProfile } from './profile';

const ITEMS: { k: keyof CrewProfile; label: string; hint: string }[] = [
  { k: 'lowTimeCaptain', label: '나는 Low Time 기장', hint: '목적지 기상을 Low Time 기장 착륙 최저치와 비교 (면제 조건은 화면에 함께)' },
  { k: 'captainHandling', label: '해 기종 기장 경험이 짧아 이착륙을 직접 해야 함', hint: '브리핑 카드에 표시' },
  { k: 'oeCaptain', label: '나는 수습(OE) 기장', hint: 'Braking Medium to Poor 이하 → 교관 이착륙 알림' },
  { k: 'foLowTime', label: '이번 편조 부기장이 Low Time', hint: '특수공항·저시정·측풍·오염·Windshear → 기장 이착륙 알림' },
  { k: 'cat3EoConfirmed', label: '회사가 이 기종을 "엔진 부작동 CAT III 가능"으로 확인함', hint: '켜면 교체공항 CAT III 구성 최저치를 주의 없이 적용 (FCOM만으로는 확정 안 됨)' },
];

export function ProfileCard() {
  const [p, setP] = useState<CrewProfile>(DEFAULT_PROFILE);
  useEffect(() => void loadProfile().then(setP), []);
  const toggle = (k: keyof CrewProfile) => {
    const next = { ...p, [k]: !p[k] };
    setP(next);
    void saveProfile(next);
  };
  return (
    <section className="card">
      <div className="card-title">
        <h3>내 운항 조건</h3>
      </div>
      <ul className="profile-list">
        {ITEMS.map((it) => (
          <li key={it.k}>
            <label className="profile-row">
              <input type="checkbox" checked={p[it.k]} onChange={() => toggle(it.k)} />
              <span>
                <b>{it.label}</b>
                <span className="muted small"> — {it.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="muted small">이 기기에만 저장 (서버로 보내지 않음). Briefing 탭과 얼러트의 Low Time·수습 조건에 쓰입니다. 기준은 회사 기준 파일(FOM 2.3.1).</p>
    </section>
  );
}
