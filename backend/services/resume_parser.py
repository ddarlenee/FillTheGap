import fitz  # PyMuPDF

def parse_pdf(pdf_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        raise ValueError("Invalid PDF — could not open file")
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    if not text.strip():
        raise ValueError("Invalid PDF — no text content found")
    return text.strip()

def parse_text(text: str) -> str:
    return text.strip()
