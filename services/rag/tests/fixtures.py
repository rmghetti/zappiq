"""
Fixtures de arquivo geradas em memoria, sem binario versionado no repositorio.

Por que gerar em vez de commitar um .docx e um .xlsx de exemplo: arquivo
binario no git nao diz o que mudou num diff, e um .docx de verdade traz dezenas
de partes irrelevantes (temas, fontes, estilos). Aqui o .docx e o minimo que o
formato OOXML exige, escrito com zipfile, e o .xlsx sai do proprio openpyxl.
Se um dia o conversor parar de ler o arquivo minimo, o teste aponta a parte
exata que falta.
"""

import io
import zipfile

CONTENT_TYPE_DOCX = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
CONTENT_TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels"
           ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
            ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""

_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>
"""


def _paragrafo(texto: str) -> str:
    seguro = texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"<w:p><w:r><w:t xml:space='preserve'>{seguro}</w:t></w:r></w:p>"


def docx_de(paragrafos: list[str]) -> bytes:
    """Monta um .docx valido com um paragrafo por item da lista."""
    corpo = "".join(_paragrafo(p) for p in paragrafos)
    documento = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{corpo}</w:body></w:document>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", _CONTENT_TYPES)
        z.writestr("_rels/.rels", _RELS)
        z.writestr("word/document.xml", documento)
    return buffer.getvalue()


def xlsx_de(abas: dict[str, list[list]]) -> bytes:
    """Monta um .xlsx com openpyxl: {'Precos': [['Curso', 'Valor'], ...]}."""
    import openpyxl

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for nome, linhas in abas.items():
        ws = wb.create_sheet(title=nome)
        for linha in linhas:
            ws.append(linha)
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def pdf_de(linhas: list[str]) -> bytes:
    """
    PDF minimo de uma pagina, escrito a mao: o pypdf le o fluxo de conteudo
    com operadores BT/Tj/ET. Evita dependencia so de teste (reportlab).
    """
    conteudo_linhas = "\n".join(
        f"BT /F1 12 Tf 72 {700 - 20 * i} Td ({texto}) Tj ET"
        for i, texto in enumerate(linhas)
    )
    fluxo = conteudo_linhas.encode("latin-1")

    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length "
        + str(len(fluxo)).encode()
        + b" >>\nstream\n"
        + fluxo
        + b"\nendstream",
    ]

    saida = bytearray(b"%PDF-1.4\n")
    posicoes = []
    for numero, corpo in enumerate(objetos, start=1):
        posicoes.append(len(saida))
        saida += f"{numero} 0 obj\n".encode() + corpo + b"\nendobj\n"

    inicio_xref = len(saida)
    saida += f"xref\n0 {len(objetos) + 1}\n".encode()
    saida += b"0000000000 65535 f \n"
    for posicao in posicoes:
        saida += f"{posicao:010d} 00000 n \n".encode()
    saida += (
        f"trailer\n<< /Size {len(objetos) + 1} /Root 1 0 R >>\n"
        f"startxref\n{inicio_xref}\n%%EOF\n"
    ).encode()
    return bytes(saida)
