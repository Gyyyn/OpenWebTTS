"""
Text processing utilities for semantic sentence splitting and text extraction.
"""
import re
import requests
from typing import List, Dict, Optional
import json


def split_into_sentences_rule_based(text: str) -> List[str]:
    """
    Rule-based sentence splitter as fallback.
    Handles common abbreviations, quotes, commas, and edge cases.
    Splits on periods, commas, and other punctuation for better semantic chunking.
    """
    # Common abbreviations that shouldn't end sentences
    abbreviations = r'(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|Inc|Ltd|Corp|St|Ave|Rd|Blvd|approx|min|max|e\.g|i\.e|vol|pp|ca|cf|ed|al|seq|c\.f)'
    
    # Replace abbreviations temporarily
    text = re.sub(f'({abbreviations})\.', r'\1<TEMP_PERIOD>', text, flags=re.IGNORECASE)
    
    # First split on sentence boundaries: . ! ? followed by space
    # Handle both straight quotes (") and smart quotes (" " ' ')
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z"\'""''\u201C\u201D\u2018\u2019])', text)
    
    # Further split each sentence on commas for better semantic chunking
    semantic_chunks = []
    for sentence in sentences:
        # Split on commas followed by space, keeping the comma with the preceding text
        parts = re.split(r'(,\s+)', sentence)
        
        # Reconstruct chunks with commas attached
        current_chunk = ""
        for i, part in enumerate(parts):
            if part.strip():  # Skip empty parts
                current_chunk += part
                # If this is a comma separator or we're at the end, finalize the chunk
                if part == ', ' or i == len(parts) - 1:
                    if current_chunk.strip():
                        semantic_chunks.append(current_chunk.strip())
                        current_chunk = ""
    
    # Restore abbreviations
    semantic_chunks = [s.replace('<TEMP_PERIOD>', '.').strip() for s in semantic_chunks if s.strip()]
    
    # Filter out empty chunks
    semantic_chunks = [s for s in semantic_chunks if len(s) > 0]
    
    return semantic_chunks


def split_into_sentences_semantic(text: str, llm_url: str = "http://localhost:11434/api/generate") -> List[str]:
    """
    Use local Qwen2.5 LLM to semantically split text into sentences.
    Falls back to rule-based splitting if LLM unavailable.
    
    Args:
        text: Text to split
        llm_url: Ollama API endpoint (default: localhost:11434)
    
    Returns:
        List of semantically meaningful sentences
    """
    # If text is short, just use rule-based
    if len(text) < 200:
        return split_into_sentences_rule_based(text)
    
    try:
        # Prepare prompt for Qwen2.5
        prompt = f"""Split the following text into semantically meaningful chunks for text-to-speech. IMPORTANT:
- Keep ALL text content - do not skip or omit anything
- Split on natural boundaries: periods (.), commas (,), semicolons (;), and other punctuation
- Preserve names in quotes (like "John Smith") as part of the chunk
- Keep dialogue and quotes as complete units
- Create smaller chunks (15-30 words each) for better highlighting during speech
- Each chunk should be a complete phrase or clause
- Maintain complete thoughts within each chunk

Return ONLY a JSON array of text chunks with ALL original text preserved.

Text:
{text[:2000]}

Format: ["chunk1", "chunk2", "chunk3", ...]"""

        payload = {
            "model": "qwen2.5:latest",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,  # Low temperature for consistent output
                "num_predict": 1000
            }
        }
        
        response = requests.post(llm_url, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            llm_output = result.get('response', '').strip()
            
            # Extract JSON array from response
            json_match = re.search(r'\[.*\]', llm_output, re.DOTALL)
            if json_match:
                sentences = json.loads(json_match.group(0))
                if sentences and isinstance(sentences, list):
                    print(f"LLM semantic splitting succeeded: {len(sentences)} sentences")
                    return [s.strip() for s in sentences if s.strip()]
        
        print("LLM response invalid, falling back to rule-based splitting")
        
    except requests.exceptions.ConnectionError:
        print("LLM not available (connection error), using rule-based splitting")
    except requests.exceptions.Timeout:
        print("LLM timeout, using rule-based splitting")
    except Exception as e:
        print(f"LLM error: {e}, falling back to rule-based splitting")
    
    # Fallback to rule-based
    return split_into_sentences_rule_based(text)


def chunk_sentences(sentences: List[str], max_chunk_size: int = 200) -> List[str]:
    """
    Group semantic text chunks that don't exceed max_chunk_size.
    Preserves semantic boundaries (sentences, clauses, phrases) for better highlighting.
    
    Args:
        sentences: List of semantic text chunks (can be sentences, clauses, or phrases)
        max_chunk_size: Maximum characters per chunk
    
    Returns:
        List of text chunks ready for TTS
    """
    chunks = []
    current_chunk = []
    current_size = 0
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        sentence_len = len(sentence)
        
        # If single sentence exceeds max, add it as its own chunk
        if sentence_len > max_chunk_size:
            # Save any current chunk first
            if current_chunk:
                chunks.append(' '.join(current_chunk))
                current_chunk = []
                current_size = 0
            # Add the long sentence as its own chunk
            chunks.append(sentence)
            continue
        
        # If adding this sentence exceeds limit and we have content, save current chunk
        if current_chunk and current_size + sentence_len + 1 > max_chunk_size:
            chunks.append(' '.join(current_chunk))
            current_chunk = []
            current_size = 0
        
        # Add sentence to current chunk
        current_chunk.append(sentence)
        current_size += sentence_len + (1 if current_chunk else 0)  # +1 for space between sentences
    
    # Add remaining sentences
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks


def process_text_for_tts(text: str, chunk_size: int = 200, use_llm: bool = True) -> List[str]:
    """
    Process text for TTS by splitting semantically and chunking appropriately.
    Creates semantic chunks based on punctuation (periods, commas) or AI analysis.
    
    Args:
        text: Input text to process
        chunk_size: Maximum characters per chunk
        use_llm: Whether to use LLM for semantic splitting (default True)
    
    Returns:
        List of text chunks ready for TTS
    """
    if not text or not text.strip():
        return []
    
    print(f"Processing text (length: {len(text)}, use_llm: {use_llm})")
    
    # Split into semantic chunks (sentences, clauses, phrases)
    if use_llm:
        semantic_chunks = split_into_sentences_semantic(text)
    else:
        semantic_chunks = split_into_sentences_rule_based(text)
    
    # Debug: Log first few chunks to verify semantic splitting
    if semantic_chunks:
        print(f"First semantic chunk: {semantic_chunks[0][:100]}...")
        if len(semantic_chunks) > 1:
            print(f"Last semantic chunk: {semantic_chunks[-1][:100]}...")
    
    # Group into final chunks respecting max size
    chunks = chunk_sentences(semantic_chunks, chunk_size)
    
    # Verify all text is preserved
    total_semantic_chars = sum(len(s) for s in semantic_chunks)
    total_chunk_chars = sum(len(c) for c in chunks)
    if total_chunk_chars < total_semantic_chars * 0.95:  # Allow 5% for whitespace normalization
        print(f"⚠️ WARNING: Text loss detected! Semantic: {total_semantic_chars} chars → Chunks: {total_chunk_chars} chars")
    
    print(f"Processed text: {len(semantic_chunks)} semantic chunks → {len(chunks)} TTS chunks")
    return chunks
