"""
PDF Processor Module
====================
Comprehensive backend PDF processing that generates structured, executable data
for efficient client-side rendering, clickability, and real-time word highlighting.

This module extracts text with precise positioning, creates word-level chunks,
and returns optimized data structures ready for client interaction.
"""

import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional, Tuple
import re
import hashlib
import json


class PDFTextElement:
    """Represents a single word or text element with position data."""
    
    def __init__(self, text: str, bbox: Tuple[float, float, float, float], 
                 font: str, size: float, page_num: int, element_id: int):
        self.text = text
        self.x0, self.y0, self.x1, self.y1 = bbox
        self.font = font
        self.size = size
        self.page_num = page_num
        self.element_id = element_id
        self.word_index = 0  # Will be set later
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.element_id,
            "text": self.text,
            "bbox": [self.x0, self.y0, self.x1, self.y1],
            "x": self.x0,
            "y": self.y0,
            "width": self.x1 - self.x0,
            "height": self.y1 - self.y0,
            "font": self.font,
            "size": self.size,
            "page": self.page_num,
            "word_idx": self.word_index
        }


class PDFPage:
    """Represents a PDF page with all text elements and metadata."""
    
    def __init__(self, page_num: int, width: float, height: float):
        self.page_num = page_num
        self.width = width
        self.height = height
        self.text_elements: List[PDFTextElement] = []
        self.full_text = ""
        self.word_map: Dict[int, List[int]] = {}  # word_index -> [element_ids]
    
    def add_element(self, element: PDFTextElement):
        """Add a text element to this page."""
        self.text_elements.append(element)
    
    def build_word_map(self):
        """Build mapping from word indices to text elements for highlighting."""
        all_text = " ".join([elem.text for elem in self.text_elements])
        self.full_text = all_text
        
        # Split into words and track their positions
        words = re.findall(r'\S+', all_text)
        current_pos = 0
        word_idx = 0
        
        for word in words:
            # Find word position in full text
            word_start = all_text.find(word, current_pos)
            word_end = word_start + len(word)
            
            # Find which elements contain this word
            char_pos = 0
            for elem_idx, elem in enumerate(self.text_elements):
                elem_start = char_pos
                elem_end = char_pos + len(elem.text) + 1  # +1 for space
                
                # Check if word overlaps with this element
                if not (word_end <= elem_start or word_start >= elem_end):
                    if word_idx not in self.word_map:
                        self.word_map[word_idx] = []
                    self.word_map[word_idx].append(elem.element_id)
                    elem.word_index = word_idx
                
                char_pos = elem_end
            
            word_idx += 1
            current_pos = word_end
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "page_num": self.page_num,
            "width": self.width,
            "height": self.height,
            "text": self.full_text,
            "elements": [elem.to_dict() for elem in self.text_elements],
            "word_map": self.word_map
        }


class PDFDocument:
    """Represents a complete PDF document with all pages and text data."""
    
    def __init__(self, pdf_bytes: bytes):
        self.pdf_bytes = pdf_bytes
        self.doc_hash = hashlib.sha256(pdf_bytes).hexdigest()
        self.pages: List[PDFPage] = []
        self.total_pages = 0
        self.full_text = ""
        self.word_to_page_map: Dict[int, int] = {}  # global word index -> page number
    
    def process(self):
        """Process the entire PDF and extract all text with positions."""
        pdf_doc = fitz.open(stream=self.pdf_bytes, filetype="pdf")
        self.total_pages = len(pdf_doc)
        
        element_counter = 0
        
        for page_num in range(self.total_pages):
            mupdf_page = pdf_doc.load_page(page_num)
            page = PDFPage(
                page_num=page_num + 1,  # 1-indexed for display
                width=mupdf_page.rect.width,
                height=mupdf_page.rect.height
            )
            
            # Extract text with detailed position information
            blocks = mupdf_page.get_text("dict")["blocks"]
            
            for block in blocks:
                if block.get("type") == 0:  # Text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "").strip()
                            if not text:
                                continue
                            
                            bbox = span.get("bbox", [0, 0, 0, 0])
                            font = span.get("font", "")
                            size = span.get("size", 12)
                            
                            element = PDFTextElement(
                                text=text,
                                bbox=bbox,
                                font=font,
                                size=size,
                                page_num=page_num + 1,
                                element_id=element_counter
                            )
                            
                            page.add_element(element)
                            element_counter += 1
            
            # Build word mapping for this page
            page.build_word_map()
            self.pages.append(page)
        
        # Build full document text and global word mapping
        self._build_global_mappings()
        
        pdf_doc.close()
    
    def _build_global_mappings(self):
        """Build global text and word-to-page mappings."""
        all_text_parts = []
        global_word_idx = 0
        
        for page in self.pages:
            page_text = page.full_text
            all_text_parts.append(page_text)
            
            # Map each word in this page to the page number
            words = re.findall(r'\S+', page_text)
            for _ in words:
                self.word_to_page_map[global_word_idx] = page.page_num
                global_word_idx += 1
        
        self.full_text = "\n".join(all_text_parts)
    
    def get_text_chunks(self, chunk_size: int = 50) -> List[Dict[str, Any]]:
        """
        Split document into readable chunks for TTS processing.
        Each chunk contains word indices for highlighting.
        """
        words = re.findall(r'\S+', self.full_text)
        chunks = []
        
        for i in range(0, len(words), chunk_size):
            chunk_words = words[i:i + chunk_size]
            chunk_text = " ".join(chunk_words)
            
            chunks.append({
                "id": len(chunks),
                "text": chunk_text,
                "word_start": i,
                "word_end": i + len(chunk_words),
                "page_start": self.word_to_page_map.get(i, 1),
                "page_end": self.word_to_page_map.get(i + len(chunk_words) - 1, 1)
            })
        
        return chunks
    
    def get_highlight_data_for_words(self, word_start: int, word_end: int) -> Dict[str, List[Dict]]:
        """
        Get highlighting data for a range of words.
        Returns element positions grouped by page for efficient rendering.
        """
        highlight_data = {}
        
        for word_idx in range(word_start, word_end):
            page_num = self.word_to_page_map.get(word_idx)
            if not page_num:
                continue
            
            # Find the page
            page = next((p for p in self.pages if p.page_num == page_num), None)
            if not page:
                continue
            
            # Get elements for this word
            element_ids = page.word_map.get(word_idx - sum(len(re.findall(r'\S+', p.full_text)) for p in self.pages if p.page_num < page_num), [])
            
            if page_num not in highlight_data:
                highlight_data[page_num] = []
            
            for elem_id in element_ids:
                elem = next((e for e in page.text_elements if e.element_id == elem_id), None)
                if elem:
                    highlight_data[page_num].append(elem.to_dict())
        
        return highlight_data
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert complete document to dictionary for JSON serialization."""
        return {
            "doc_hash": self.doc_hash,
            "total_pages": self.total_pages,
            "full_text": self.full_text,
            "pages": [page.to_dict() for page in self.pages],
            "word_count": len(re.findall(r'\S+', self.full_text)),
            "word_to_page": self.word_to_page_map
        }


def process_pdf_for_interactive_reading(pdf_bytes: bytes, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Main entry point for PDF processing.
    
    Args:
        pdf_bytes: Raw PDF file bytes
        options: Optional processing options (e.g., chunk_size, skip_headers)
    
    Returns:
        Complete structured data ready for client-side rendering and interaction
    """
    options = options or {}
    chunk_size = options.get("chunk_size", 50)
    
    # Create and process document
    doc = PDFDocument(pdf_bytes)
    doc.process()
    
    # Get reading chunks
    chunks = doc.get_text_chunks(chunk_size=chunk_size)
    
    # Build optimized structure
    result = {
        "status": "success",
        "document": {
            "hash": doc.doc_hash,
            "total_pages": doc.total_pages,
            "word_count": len(re.findall(r'\S+', doc.full_text)),
            "full_text": doc.full_text
        },
        "pages": [page.to_dict() for page in doc.pages],
        "chunks": chunks,
        "metadata": {
            "processing_version": "1.0",
            "chunk_size": chunk_size,
            "total_chunks": len(chunks)
        }
    }
    
    return result


def get_highlight_data_for_chunk(pdf_data: Dict[str, Any], chunk_id: int) -> Dict[str, Any]:
    """
    Extract highlighting data for a specific chunk from processed PDF data.
    This is a utility function for real-time highlighting during playback.
    
    Args:
        pdf_data: The complete processed PDF data structure
        chunk_id: ID of the chunk to highlight
    
    Returns:
        Highlighting information for the requested chunk
    """
    chunks = pdf_data.get("chunks", [])
    if chunk_id >= len(chunks):
        return {"error": "Invalid chunk ID"}
    
    chunk = chunks[chunk_id]
    word_start = chunk["word_start"]
    word_end = chunk["word_end"]
    
    # Find elements to highlight
    highlight_elements = {}
    
    for page_data in pdf_data.get("pages", []):
        page_num = page_data["page_num"]
        
        for element in page_data["elements"]:
            word_idx = element.get("word_idx", 0)
            if word_start <= word_idx < word_end:
                if page_num not in highlight_elements:
                    highlight_elements[page_num] = []
                highlight_elements[page_num].append(element)
    
    return {
        "chunk_id": chunk_id,
        "chunk_text": chunk["text"],
        "page_range": [chunk["page_start"], chunk["page_end"]],
        "elements": highlight_elements
    }
