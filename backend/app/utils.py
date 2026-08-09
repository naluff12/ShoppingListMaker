"""Utilidades de evaluación aritmética segura (sin eval()) y conversión de unidades."""
import ast
import operator
from typing import Optional

# Masa (gramos) por unidad base
UNIT_GRAMS = {
    'g': 1.0,
    'gr': 1.0,
    'gramos': 1.0,
    'kg': 1000.0,
    'kilo': 1000.0,
    'kilos': 1000.0,
    'kilogramo': 1000.0,
    'kilogramos': 1000.0,
    'L': 1000.0,      # 1 litro ≈ 1000 g (agua; aproximación para líquidos)
    'l': 1000.0,
    'lt': 1000.0,
    'litro': 1000.0,
    'litros': 1000.0,
    'ml': 1.0,        # 1 ml ≈ 1 g
    'mililitro': 1.0,
    'mililitros': 1.0,
    'piezas': None,   # requiere peso_promedio del producto
    'pieza': None,
    'pza': None,
    'uds': None,
    'unidad': None,
    'unidades': None,
}


def convert_to_grams(cantidad: float, unit: str, peso_promedio: Optional[float] = None) -> Optional[float]:
    """Convierte cantidad+unidad a gramos.

    - Unidades de masa (g, kg, L, ml): conversión directa.
    - Piezas: requiere peso_promedio (gramos por pieza). Si falta, devuelve None.
    - Unidad desconocida: devuelve None.
    """
    if cantidad is None:
        return None
    key = (unit or '').strip().lower()
    factor = UNIT_GRAMS.get(key)
    if factor is not None:
        return cantidad * factor
    if key in ('piezas', 'pieza', 'pza', 'uds', 'unidad', 'unidades'):
        if peso_promedio:
            return cantidad * peso_promedio
        return None
    return None


def format_grams(grams: Optional[float]) -> str:
    """Formatea gramos como '1.2 kg', '350 g', etc."""
    if grams is None or grams <= 0:
        return ''
    if grams >= 1000:
        kg = grams / 1000.0
        return f"{kg:g} kg"
    return f"{grams:g} g"


def calc_price_from_base(cantidad: float, unit: str, precio_base: Optional[float], precio_base_unit: Optional[str], peso_promedio: Optional[float]) -> Optional[float]:
    """Calcula el precio total del item según la base definida en el producto.

    - base 'kg': precio por kilogramo → precio = precio_base × gramos/1000
    - base 'pieza': precio por pieza → precio = precio_base × cantidad (solo si unit es piezas)
    - sin base: devuelve None (el precio es manual)
    """
    if not precio_base:
        return None
    unit_key = (unit or '').strip().lower()
    if precio_base_unit == 'kg':
        grams = convert_to_grams(cantidad, unit, peso_promedio)
        if grams is None:
            return None
        return round(precio_base * grams / 1000.0, 2)
    if precio_base_unit == 'pieza':
        if unit_key in ('piezas', 'pieza', 'pza', 'uds', 'unidad', 'unidades'):
            return round(precio_base * cantidad, 2)
        # Si el item está en kg/g pero la base es por pieza, convertir cantidad→piezas
        grams = convert_to_grams(cantidad, unit, peso_promedio)
        if grams is not None and peso_promedio:
            return round(precio_base * (grams / peso_promedio), 2)
        return None
    return None


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
