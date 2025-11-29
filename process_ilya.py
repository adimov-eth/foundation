
def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    processed_text = ""
    current_paragraph = []

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        current_paragraph.append(line)
        
        # Heuristic: If line ends with punctuation AND is relatively short, it's likely a paragraph end.
        # The average length was ~40 chars. 60 seems like a safe upper bound for a "short" line that ends a sentence/thought in subtitles.
        # Also check if it's the last line.
        if (line[-1] in '.?!' and len(line) < 60) or i == len(lines) - 1:
            processed_text += " ".join(current_paragraph) + "\n\n"
            current_paragraph = []

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(processed_text)

if __name__ == "__main__":
    process_file('/Users/adimov/Developer/foundation/ilya_ru.txt')
