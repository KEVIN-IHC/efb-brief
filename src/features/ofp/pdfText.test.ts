import { describe, expect, it } from 'vitest';
import { itemsToLines } from './pdfText';

// 고정폭 6pt 글자 가정
const item = (str: string, col: number, y: number) => ({ str, x: 40 + col * 6, y, w: str.length * 6, h: 10 });

describe('itemsToLines', () => {
  it('같은 y는 한 줄, 위에서 아래 순서, 열 위치 유지', () => {
    const lines = itemsToLines([
      item('KLAX', 20, 700),
      item('FUEL', 0, 700),
      item('TRIP', 0, 688),
      item('93800', 10, 688.3), // 미세한 y 차이도 같은 줄
    ]);
    expect(lines).toEqual(['FUEL                KLAX', 'TRIP      93800']);
  });
  it('붙어 있는 조각은 공백 하나로 구분', () => {
    expect(itemsToLines([item('AB', 0, 100), item('CD', 1, 100)])).toEqual(['AB CD']);
  });
  it('빈 입력', () => {
    expect(itemsToLines([])).toEqual([]);
  });
});
