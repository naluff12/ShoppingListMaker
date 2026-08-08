"""Utilidades de evaluación aritmética segura (sin eval())."""
import ast
import operator


def _safe_eval_arithmetic(expr: str) -> int:
    """Evaluate simple arithmetic expressions without using eval().
    Only supports integers, +, -, *, /, parentheses."""
    allowed_ops = {
        ast.Add: operator.add, ast.Sub: operator.sub,
        ast.Mult: operator.mul, ast.Div: operator.floordiv,
        ast.USub: operator.neg,
    }
    try:
        tree = ast.parse(expr, mode='eval')
    except SyntaxError:
        raise ValueError(f"Invalid expression: {expr}")

    def _eval(node):
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return int(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in allowed_ops:
            return allowed_ops[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in allowed_ops:
            return allowed_ops[type(node.op)](_eval(node.operand))
        raise ValueError(f"Unsupported expression node: {type(node).__name__}")

    return _eval(tree)
