
import statistics

def analyze(filepath):
    lengths = []
    ends_with_punct = 0
    short_lines_punct = 0
    total_lines = 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    total_lines = len(lines)
    print(f"Total lines: {total_lines}")
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line: continue
        lengths.append(len(line))
        
        if line[-1] in '.?!':
            ends_with_punct += 1
            if len(line) < 45: # Heuristic threshold
                short_lines_punct += 1
                if i < 20: # Print first few for visual check
                    print(f"Short punct line {i+1}: {line} (len={len(line)})")

    print(f"Avg length: {statistics.mean(lengths):.2f}")
    print(f"Max length: {max(lengths)}")
    print(f"Lines ending with punct: {ends_with_punct}")
    print(f"Short lines (<45) ending with punct: {short_lines_punct}")

analyze('/Users/adimov/Developer/foundation/ilya_ru.txt')
