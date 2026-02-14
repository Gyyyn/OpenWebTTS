"""
Test Script for PDF Backend Processing System
==============================================

This script tests the PDF processor module to ensure it works correctly.

Usage:
    python test_pdf_backend.py path/to/sample.pdf
"""

import sys
import json
from pathlib import Path


def test_pdf_processor(pdf_path: str):
    """Test the PDF processor with a sample PDF file."""
    
    print("=" * 60)
    print("PDF Backend Processing System - Test")
    print("=" * 60)
    print()
    
    # Check if file exists
    pdf_file = Path(pdf_path)
    if not pdf_file.exists():
        print(f"❌ Error: PDF file not found: {pdf_path}")
        return False
    
    print(f"📄 Testing with: {pdf_file.name}")
    print(f"   Size: {pdf_file.stat().st_size / 1024:.2f} KB")
    print()
    
    # Import the processor
    try:
        from functions.pdf_processor import process_pdf_for_interactive_reading
        print("✅ PDF processor module imported successfully")
    except Exception as e:
        print(f"❌ Failed to import PDF processor: {e}")
        return False
    
    # Read PDF bytes
    try:
        with open(pdf_file, 'rb') as f:
            pdf_bytes = f.read()
        print(f"✅ Read {len(pdf_bytes)} bytes from PDF")
    except Exception as e:
        print(f"❌ Failed to read PDF file: {e}")
        return False
    
    # Process PDF
    print()
    print("🔄 Processing PDF...")
    try:
        result = process_pdf_for_interactive_reading(
            pdf_bytes=pdf_bytes,
            options={"chunk_size": 50}
        )
        print("✅ PDF processing completed!")
    except Exception as e:
        print(f"❌ PDF processing failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Display results
    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print()
    
    doc_info = result['document']
    print(f"📊 Document Information:")
    print(f"   Hash: {doc_info['hash'][:16]}...")
    print(f"   Total Pages: {doc_info['total_pages']}")
    print(f"   Word Count: {doc_info['word_count']}")
    print(f"   Text Length: {len(doc_info['full_text'])} characters")
    print()
    
    print(f"📑 Page Information:")
    print(f"   Total Pages Processed: {len(result['pages'])}")
    if result['pages']:
        first_page = result['pages'][0]
        print(f"   First Page:")
        print(f"      - Page Number: {first_page['page_num']}")
        print(f"      - Dimensions: {first_page['width']} x {first_page['height']}")
        print(f"      - Text Elements: {len(first_page['elements'])}")
        print(f"      - Words Mapped: {len(first_page.get('word_map', {}))}")
    print()
    
    print(f"📝 Chunk Information:")
    print(f"   Total Chunks: {len(result['chunks'])}")
    print(f"   Chunk Size: {result['metadata']['chunk_size']} words")
    if result['chunks']:
        first_chunk = result['chunks'][0]
        print(f"   First Chunk:")
        print(f"      - ID: {first_chunk['id']}")
        print(f"      - Word Range: {first_chunk['word_start']} - {first_chunk['word_end']}")
        print(f"      - Page Range: {first_chunk['page_start']} - {first_chunk['page_end']}")
        print(f"      - Text Preview: {first_chunk['text'][:100]}...")
    print()
    
    # Sample element
    if result['pages'] and result['pages'][0]['elements']:
        print(f"🔤 Sample Text Element:")
        sample_elem = result['pages'][0]['elements'][0]
        print(f"   {json.dumps(sample_elem, indent=6)}")
        print()
    
    # Validate structure
    print("=" * 60)
    print("VALIDATION")
    print("=" * 60)
    print()
    
    checks_passed = 0
    checks_total = 0
    
    # Check 1: Result has required keys
    checks_total += 1
    required_keys = ['status', 'document', 'pages', 'chunks', 'metadata']
    if all(key in result for key in required_keys):
        print("✅ Result contains all required keys")
        checks_passed += 1
    else:
        print("❌ Result missing required keys")
    
    # Check 2: Document has content
    checks_total += 1
    if len(doc_info['full_text']) > 0:
        print("✅ Document contains text")
        checks_passed += 1
    else:
        print("❌ Document text is empty")
    
    # Check 3: Pages processed
    checks_total += 1
    if len(result['pages']) > 0:
        print(f"✅ Processed {len(result['pages'])} pages")
        checks_passed += 1
    else:
        print("❌ No pages processed")
    
    # Check 4: Elements extracted
    checks_total += 1
    total_elements = sum(len(page['elements']) for page in result['pages'])
    if total_elements > 0:
        print(f"✅ Extracted {total_elements} text elements")
        checks_passed += 1
    else:
        print("❌ No text elements extracted")
    
    # Check 5: Chunks created
    checks_total += 1
    if len(result['chunks']) > 0:
        print(f"✅ Created {len(result['chunks'])} reading chunks")
        checks_passed += 1
    else:
        print("❌ No chunks created")
    
    # Check 6: Word mapping exists
    checks_total += 1
    if result['pages'] and result['pages'][0].get('word_map'):
        print("✅ Word mapping created")
        checks_passed += 1
    else:
        print("❌ No word mapping found")
    
    # Check 7: Elements have required fields
    checks_total += 1
    if result['pages'] and result['pages'][0]['elements']:
        elem = result['pages'][0]['elements'][0]
        required_fields = ['id', 'text', 'x', 'y', 'width', 'height', 'font', 'size', 'page', 'word_idx']
        if all(field in elem for field in required_fields):
            print("✅ Elements have all required fields")
            checks_passed += 1
        else:
            print("❌ Elements missing required fields")
    else:
        print("⚠️  Cannot validate element fields (no elements)")
    
    print()
    print("=" * 60)
    print(f"VALIDATION RESULTS: {checks_passed}/{checks_total} checks passed")
    print("=" * 60)
    print()
    
    if checks_passed == checks_total:
        print("🎉 All tests passed! The PDF backend system is working correctly.")
        return True
    elif checks_passed >= checks_total * 0.7:
        print("⚠️  Most tests passed, but some issues detected. Review the output above.")
        return True
    else:
        print("❌ Many tests failed. There may be issues with the PDF or the processor.")
        return False


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python test_pdf_backend.py path/to/sample.pdf")
        print()
        print("Example:")
        print("    python test_pdf_backend.py documents/sample.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    success = test_pdf_processor(pdf_path)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
