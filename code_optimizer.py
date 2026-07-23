import ast

def analyze_complexity(file_path):
    with open(file_path, "r") as f:
        tree = ast.parse(f.read())
    # Zoekt naar diepe nesting (loops in loops)
    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.While)):
            for subnode in ast.walk(node):
                if isinstance(subnode, (ast.For, ast.While)) and subnode != node:
                    print(f"Snelheid-lek gevonden: Diepe nesting in {file_path}")
                    return True
    return False

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        analyze_complexity(sys.argv[1])
    else:
        print("Usage: python code_optimizer.py <file_path>")
