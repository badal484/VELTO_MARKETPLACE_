
import sys

def count_braces(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    open_braces = content.count('{')
    close_braces = content.count('}')
    open_parens = content.count('(')
    close_parens = content.count(')')
    
    print(f"Braces: {open_braces} open, {close_braces} close")
    print(f"Parens: {open_parens} open, {close_parens} close")
    
    if open_braces != close_braces:
        print("MISMATCH IN BRACES!")
    if open_parens != close_parens:
        print("MISMATCH IN PARENS!")

if __name__ == "__main__":
    count_braces(sys.argv[1])
