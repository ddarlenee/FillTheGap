import pytest
from services.resume_parser import parse_pdf, parse_text

def test_parse_text_passthrough():
    result = parse_text("Python developer with 5 years experience")
    assert result == "Python developer with 5 years experience"

def test_parse_pdf_invalid_bytes_raises():
    with pytest.raises(ValueError, match="Invalid PDF"):
        parse_pdf(b"not a pdf")
