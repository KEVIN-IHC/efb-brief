"""매뉴얼 그림·표 쪽 사진 묶음 (D-076). Mac에서만 실행, 결과는 private/ 안에만 (D-028, D-044).

글 묶음(<docId>.efbman.json.gz)의 쪽마다 원본 PDF 쪽을 찾아, 그림이나 그려진 표가 있는 쪽만
JPEG(110dpi, 품질 60)로 만들어 사진 묶음 파일로 낸다. 토큰을 쓰지 않는다 (Mac 안에서 처리).

사용:
  python pdf2img.py <in.pdf> <bundle.efbman.json.gz> <out 접두어> [--raster-only] [--max-mb 40]

파일 형식 (.efbimg): b"EFBIMG1\\n" + 머리 길이(4바이트, big-endian) + 머리 JSON(UTF-8) + 사진 바이트들
  머리 = { format, version, docId, issueDate, part, parts, pdfPages, map: {쪽 seq: PDF 쪽 번호(1부터)},
           images: [{ pdf, off, len, w, h }] }
  map은 모든 부분 파일에 같이 들어 있다 (어느 부분을 먼저 가져와도 됨)
"""
import gzip
import json
import re
import struct
import sys
import time

import pymupdf

MAGIC = b"EFBIMG1\n"


def norm(s):
    return re.sub(r"\s+", "", s or "")


def map_pages(bundle_pages, doc):
    """글 묶음 쪽 seq → PDF 쪽 번호(1부터). pdfPage가 있으면 그대로, 없으면 쪽 표시(ref) 글자를 차례로 찾는다"""
    out = {}
    if any(p.get("pdfPage") for p in bundle_pages):
        for p in bundle_pages:
            if p.get("pdfPage"):
                out[p["seq"]] = int(p["pdfPage"])
        return out
    texts = [norm(doc[i].get_text()) for i in range(doc.page_count)]
    ptr = 0
    for p in bundle_pages:
        r = norm(p.get("ref"))
        if not r:
            continue
        for i in range(ptr, min(len(texts), ptr + 600)):
            if r in texts[i]:
                out[p["seq"]] = i + 1
                ptr = i + 1
                break
    return out


def has_figure(page, raster_only):
    """큰 그림(작은 로고 제외) 또는 선이 많은 쪽(그림·표)"""
    for x in page.get_images(full=True):
        try:
            for r in page.get_image_rects(x[0]):
                if r.width * r.height > 60 * 60:
                    return True
        except Exception:
            pass
    if raster_only:
        return False
    return len(page.get_drawings()) > 80


def main():
    args = sys.argv[1:]
    if len(args) < 3:
        sys.stderr.write(__doc__)
        sys.exit(2)
    pdf, bundle_path, prefix = args[:3]
    raster_only = "--raster-only" in args
    max_mb = float(args[args.index("--max-mb") + 1]) if "--max-mb" in args else 40.0

    t0 = time.time()
    b = json.load(gzip.open(bundle_path))
    meta, pages = b["meta"], b["pages"]
    doc = pymupdf.open(pdf)
    seq2pdf = map_pages(pages, doc)
    wanted = sorted({n for n in seq2pdf.values() if 1 <= n <= doc.page_count and has_figure(doc[n - 1], raster_only)})

    parts, cur, size = [], [], 0
    for n in wanted:
        pix = doc[n - 1].get_pixmap(dpi=110, alpha=False)
        jpg = pix.tobytes("jpeg", jpg_quality=60)
        if cur and size + len(jpg) > max_mb * 1048576:
            parts.append(cur)
            cur, size = [], 0
        cur.append((n, jpg, pix.width, pix.height))
        size += len(jpg)
    if cur:
        parts.append(cur)

    files, total = [], 0
    for k, part in enumerate(parts or [[]]):
        off, imgs = 0, []
        for n, jpg, w, h in part:
            imgs.append({"pdf": n, "off": off, "len": len(jpg), "w": w, "h": h})
            off += len(jpg)
        head = json.dumps(
            {
                "format": "efbimg",
                "version": 1,
                "docId": meta["docId"],
                "issueDate": meta.get("issueDate"),
                "part": k + 1,
                "parts": len(parts) or 1,
                "pdfPages": doc.page_count,
                "map": {str(s): n for s, n in seq2pdf.items()},
                "images": imgs,
            },
            ensure_ascii=False,
        ).encode("utf-8")
        name = f"{prefix}.efbimg" if len(parts) <= 1 else f"{prefix}-{k + 1}.efbimg"
        with open(name, "wb") as f:
            f.write(MAGIC + struct.pack(">I", len(head)) + head)
            for _, jpg, _, _ in part:
                f.write(jpg)
        total += off + len(head)
        files.append(name)

    print(
        json.dumps(
            {
                "docId": meta["docId"],
                "mapped": len(seq2pdf),
                "pages": len(pages),
                "images": len(wanted),
                "mb": round(total / 1048576, 1),
                "files": files,
                "sec": round(time.time() - t0),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
