#!/usr/bin/env python3
import json, re, sys, argparse
from collections import Counter, defaultdict
from typing import List, Dict, Any

RA_RE = re.compile(r"^RA(\d+)$", re.I)
CE_RE = re.compile(r"^CE(\d+)\.(\d+)$", re.I)

def norm(s): return (s or "").strip()

def validate_asignatura(a: Dict[str, Any]) -> Dict[str, List[str]]:
    errors, warns = [], []

    # Campos básicos
    if not norm(a.get("id")):
        errors.append("Falta o vacío: id")
    if not norm(a.get("nombre")):
        errors.append("Falta o vacío: nombre")

    ra_list = a.get("RA")
    if not isinstance(ra_list, list) or len(ra_list) == 0:
        errors.append("Falta RA[] o está vacío")
        return {"errors": errors, "warns": warns}  # sin RA no seguimos

    # RAs duplicados por código
    ra_codes = [norm(r.get("codigo")) for r in ra_list]
    dup_ra = [c for c, n in Counter(ra_codes).items() if n > 1]
    if dup_ra:
        errors.append(f"RA duplicados: {', '.join(dup_ra)}")

    # Validación por RA
    for r in ra_list:
        rcode = norm(r.get("codigo"))
        if not rcode:
            errors.append("RA sin 'codigo'")
            continue

        mra = RA_RE.match(rcode)
        if not mra:
            errors.append(f"RA codigo inválido: {rcode} (esperado RA#)")
            continue

        ra_num = int(mra.group(1))
        if not norm(r.get("descripcion")):
            warns.append(f"{rcode} sin descripcion")

        ce_list = r.get("CE") or []
        # Duplicados de CE por (codigo, descripcion)
        dup_ce = [k for k, n in Counter((norm(c.get("codigo")), norm(c.get("descripcion"))) for c in ce_list).items() if n > 1]
        if dup_ce:
            errors.append(f"{rcode} tiene CE duplicados exactos")

        # Validar codificación y numeración de CE
        last_idx = 0
        bad_code, jumps = False, False
        seen_codes = set()
        for c in ce_list:
            cc = norm(c.get("codigo"))
            if not cc:
                errors.append(f"{rcode} contiene CE sin 'codigo'")
                continue
            mc = CE_RE.match(cc)
            if not mc:
                errors.append(f"{rcode} CE codigo inválido: {cc} (esperado CE{ra_num}.#)")
                bad_code = True
                continue

            ra_in_code = int(mc.group(1))
            idx = int(mc.group(2))
            if ra_in_code != ra_num:
                errors.append(f"{rcode} CE mal referenciado: {cc} (RA en CE={ra_in_code} != {ra_num})")

            if cc in seen_codes:
                errors.append(f"{rcode} CE codigo repetido: {cc}")
            seen_codes.add(cc)

            if idx != last_idx + 1 and idx != 1:  # permitimos que empiece en 1
                jumps = True
            last_idx = idx

        if not ce_list:
            warns.append(f"{rcode} sin CE")
        elif bad_code:
            pass  # ya reportado
        elif jumps:
            warns.append(f"{rcode} CE no consecutivos (revisa numeración)")

    return {"errors": errors, "warns": warns}

def main():
    ap = argparse.ArgumentParser(description="Valida JSON legacy de asignaturas (id, nombre, RA[], CE[]).")
    ap.add_argument("path", nargs="?", default="public/asignaturas_FP.json", help="Ruta del JSON legacy")
    args = ap.parse_args()

    try:
        with open(args.path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ No se pudo leer '{args.path}': {e}")
        sys.exit(2)

    if not isinstance(data, list):
        print("❌ El JSON raíz debe ser una lista de asignaturas.")
        sys.exit(2)

    total = len(data)
    num_ok = 0
    has_errors = False
    resumen_warns = 0

    print(f"🔎 Validando {total} asignaturas de '{args.path}'...\n")

    for a in data:
        nombre = f"{norm(a.get('id'))} – {norm(a.get('nombre'))}"
        res = validate_asignatura(a)
        if res["errors"]:
            has_errors = True
            print(f"❌ {nombre}")
            for e in res["errors"]:
                print(f"   • ERROR: {e}")
            for w in res["warns"]:
                print(f"   • WARN : {w}")
            print()
        else:
            num_ok += 1
            if res["warns"]:
                resumen_warns += len(res["warns"])
                print(f"⚠️  {nombre}")
                for w in res["warns"]:
                    print(f"   • WARN : {w}")
                print()
            else:
                # OK silencioso para no saturar
                pass

    print("———")
    print(f"✅ OK: {num_ok}/{total} asignaturas sin errores")
    if resumen_warns:
        print(f"⚠️  Avisos: {resumen_warns} (no bloquean)")

    sys.exit(1 if has_errors else 0)

if __name__ == "__main__":
    main()
