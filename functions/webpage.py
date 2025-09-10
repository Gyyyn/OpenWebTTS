import re
from bs4 import BeautifulSoup, Comment

def extract_readable_content(html_content):
    """
    Analyzes an HTML document to extract the main readable content, similar to a "reader mode".
    This is useful for passing clean text to a Text-to-Speech (TTS) engine.

    Args:
        html_content (str): The HTML content of the page as a string.

    Returns:
        BeautifulSoup.Tag or None: The Tag object containing the main content, 
                                   or None if no suitable content is found.
    """
    # Regular expressions for matching class names and IDs.
    UNLIKELY_CANDIDATES_REGEX = re.compile(
        r'combx|comment|community|disqus|extra|foot|header|menu|remark|rss|shoutbox|sidebar|sponsor|ad-break|agegate|pagination|pager|popup|tweet|twitter',
        re.I
    )
    LIKELY_CANDIDATES_REGEX = re.compile(
        r'article|body|content|entry|hentry|main|page|pagination|post|text|blog|story',
        re.I
    )
    
    # Tags to remove from the document immediately.
    TAGS_TO_REMOVE = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'noscript']

    soup = BeautifulSoup(html_content, 'html.parser')

    # 1. Remove unwanted tags, comments, etc. from the document.
    for tag in TAGS_TO_REMOVE:
        for el in soup.find_all(tag):
            el.decompose()
            
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    def get_element_score(element):
        """
        Calculates a score for an element based on its content and attributes.
        
        Args:
            element (BeautifulSoup.Tag): The element to score.

        Returns:
            int: The calculated score.
        """
        if not hasattr(element, 'name') or element.name is None:
            return 0
            
        score = 0
        tag_name = element.name.lower()

        # Initial score based on tag type.
        if tag_name == 'article':
            score += 10
        elif tag_name == 'div':
            score += 5
        elif tag_name in ['pre', 'td', 'blockquote']:
            score += 3
        elif tag_name in ['address', 'ol', 'ul', 'dl', 'dd', 'dt', 'li']:
            score -= 3
        elif tag_name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th']:
            score -= 5

        # Add points for likely classes and IDs.
        class_name = ' '.join(element.get('class', []))
        element_id = element.get('id', '')
        
        if LIKELY_CANDIDATES_REGEX.search(class_name):
            score += 25
        if LIKELY_CANDIDATES_REGEX.search(element_id):
            score += 25

        # Subtract points for unlikely classes and IDs.
        if UNLIKELY_CANDIDATES_REGEX.search(class_name):
            score -= 25
        if UNLIKELY_CANDIDATES_REGEX.search(element_id):
            score -= 25

        # Add points based on the length of the text content.
        text_content = element.get_text(strip=True)
        score += len(text_content.split(','))
        score += min(len(text_content) // 100, 3)

        return score

    # 2. Find all potential content elements and score them.
    # Using a list of tuples (score, tag_object) to avoid issues with mutable dict keys
    scored_candidates = []
    all_elements = soup.find_all(True)

    # Dictionary to aggregate scores for unique parent/grandparent tags
    aggregated_scores = {}

    for i, element in enumerate(all_elements):
        # Ensure the element has a parent and it's a Tag before processing
        if not hasattr(element, 'parent') or element.parent is None or not hasattr(element, 'name') or element.name is None:
            continue
            
        score = get_element_score(element)
        # Store score directly on the tag object for later access
        element['readability_score'] = score 
        
        # Propagate score to parent and grandparent
        current_parent = element.parent
        # Ensure current_parent is a Tag object and not the BeautifulSoup object itself
        if current_parent and hasattr(current_parent, 'name') and current_parent.name is not None and current_parent != soup:
            # Add element and its score to the aggregated_scores for parents
            aggregated_scores[current_parent] = aggregated_scores.get(current_parent, 0) + score
            
            grand_parent = current_parent.parent
            # Ensure grand_parent is a Tag object and not the BeautifulSoup object itself
            if grand_parent and hasattr(grand_parent, 'name') and grand_parent.name is not None and grand_parent != soup:
                aggregated_scores[grand_parent] = aggregated_scores.get(grand_parent, 0) + score / 2

    # Convert aggregated_scores to a list of (score, tag) tuples
    for tag, score in aggregated_scores.items():
        scored_candidates.append((score, tag))

    # 3. Find the element with the highest score from the scored_candidates list.
    top_candidate = None
    max_score = -1

    if scored_candidates:
        # Or iterate to find max, which is more robust for equal scores with tag objects
        for score, element_tag in scored_candidates:
            if score > max_score:
                max_score = score
                top_candidate = element_tag
    
    # If we have a top candidate, clean it up further.
    if top_candidate:
        # Use max_score directly as the top_score for threshold calculation
        top_score_for_threshold = max_score
        children = list(top_candidate.children)
        
        elements_to_remove = []
        for i, child in enumerate(children):
            if hasattr(child, 'name') and child.name is not None:
                # Use the readability_score stored on the child element itself
                child_score = child.get('readability_score', 0)
                # If a child's score is low compared to the top candidate, it's likely not part of the main content.
                if child_score < top_score_for_threshold * 0.2:
                    elements_to_remove.append(child)
        
        # Decompose elements after iteration is complete
        for child_to_remove in elements_to_remove:
            child_to_remove.decompose()

    return top_candidate.get_text(strip=True) if top_candidate else ""