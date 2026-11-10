"""매뉴얼 PDF → Markdown (pymupdf4llm). Mac에서만 실행, 결과는 private/ 안에만 둔다 (D-028, D-044).

사용:
  python pdf2md.py convert <in.pdf> <out.md>   # 변환 (큰 매뉴얼은 오래 걸림)
  python pdf2md.py probe <in.pdf>              # 앞 6쪽 글만 출력 (종류·발행일 확인용, 빠름)

pymupdf-layout 이 설치돼 있으면 레이아웃 분석(표·그림 글)을 함께 쓴다.
"""
import sys


def probe(path: str) -> None:
    import pymupdf

    doc = pymupdf.open(path)
    out = [f"@@PAGES {doc.page_count}"]
    for i in range(min(6, doc.page_count)):
        out.append(doc[i].get_text())
    sys.stdout.write("\n".join(out))


def convert(path: str, out: str) -> None:
    try:
        import pymupdf.layout  # noqa: F401  (있으면 레이아웃 모드)
    except Exception:
        pass
    import pymupdf4llm

    md = pymupdf4llm.to_markdown(path)  # 쪽 표시(머리·꼬리말)를 남기는 기본값 — 쪽 나누기에 필요
    with open(out, "w", encoding="utf-8") as f:
        f.write(md)


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "probe":
        probe(sys.argv[2])
    elif len(sys.argv) >= 4 and sys.argv[1] == "convert":
        convert(sys.argv[2], sys.argv[3])
    else:
        sys.stderr.write(__doc__)
        sys.exit(2)
