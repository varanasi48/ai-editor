"""
Utility functions for extracting text from DOCX files
"""
from docx import Document

def extract_text_from_docx(docx_path):
    """
    Extract text from a DOCX file
    
    Args:
        docx_path (str): Path to the DOCX file
        
    Returns:
        str: Extracted text from the document
    """
    try:
        doc = Document(docx_path)
        
        # Extract text from paragraphs
        text_content = []
        
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():  # Only add non-empty paragraphs
                text_content.append(paragraph.text)
        
        # Extract text from tables
        for table in doc.tables:
            for row in table.rows:
                row_text = []
                for cell in row.cells:
                    if cell.text.strip():
                        row_text.append(cell.text.strip())
                if row_text:
                    text_content.append(" | ".join(row_text))
        
        return "\n\n".join(text_content)
        
    except Exception as e:
        raise Exception(f"Error extracting text from DOCX: {str(e)}")
