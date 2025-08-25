import json
import re
import time
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import os

# ================== Config ==================
BASE = "https://centrosdocentes.catedu.es"
FAMILIA_URL = f"{BASE}/awc/public/pages/familias/ciclos.php?familia=IFC"
HEADERS = {
    "User-Agent": "SkillForgeScraper/1.0 (+https://skillforge.local) Python-requests",
    "Accept-Language": "es-ES,es;q=0.9",
}
SLEEP = (0.5, 1.2)

# ================== Modelos internos ==================
@dataclass
class Criterio:
    codigo: str
    descripcion: str

@dataclass
class RA:
    codigo: str
    descripcion: str
    CE: List[Criterio]

@dataclass
class Modulo:
    codigo: str
    nombre: str
    ciclo_codigo: str
    ciclo_nombre: str
    curso: Optional[str]
    horas_totales: Optional[int]
    horas_semanales: Optional[int]
    creditos: Optional[str]  # <- intentamos extraer "10" de "10.0 Créditos ECTS"
    RA: List[RA]

@dataclass
class Ciclo:
    codigo: str
    nombre: str
    nivel: str
    modulos: List[Modulo]

# ================== Sesión HTTP ==================
session = requests.Session()
session.headers.update(HEADERS)

def get_soup(url: str) -> BeautifulSoup:
    last_exc = None
    for i in range(3):
        try:
            resp = session.get(url, timeout=25)
            if resp.ok:
                return BeautifulSoup(resp.text, "html.parser")
            last_exc = requests.HTTPError(f"{resp.status_code} for {url}")
        except requests.RequestException as e:
            last_exc = e
        time.sleep(0.6 + i * 0.6)
    if last_exc:
        raise last_exc
    raise RuntimeError(f"No se pudo descargar: {url}")

# ================== Scrape: índice de ciclos ==================
def parse_ciclos_ifc() -> List[Dict[str, str]]:
    soup = get_soup(FAMILIA_URL)
    links = soup.find_all("a", href=re.compile(r"info_ciclo\.php\?codciclo=IFC\d+"))
    ciclos = []
    for a in links:
        href = (a.get("href") or "").strip()
        if not href:
            continue
        url = href if href.startswith("http") else urljoin(FAMILIA_URL, href)
        text = a.get_text(" ", strip=True)
        m = re.search(r"(IFC\d{3})", text)
        codigo = m.group(1) if m else ""
        nombre = text.replace(codigo, "").strip(" -—·\u00A0")
        nivel = "Desconocido"

        # Inferir nivel por contexto
        h_section = a.find_parent()
        while h_section and h_section.name not in ("body",):
            if h_section.name in ("section", "div"):
                hdr = h_section.get_text(" ", strip=True).lower()
                if "básico" in hdr:
                    nivel = "CFGB"
                elif "grado medio" in hdr:
                    nivel = "CFGM"
                elif "grado superior" in hdr:
                    nivel = "CFGS"
                elif "especialización" in hdr:
                    nivel = "CES"
            h_section = h_section.parent

        ciclos.append({"nombre": nombre, "codigo": codigo, "nivel": nivel, "url": url})

    for c in ciclos:
        if c["nivel"] == "Desconocido":
            if c["codigo"].startswith("IFC2"):
                c["nivel"] = "CFGM"
            elif c["codigo"].startswith("IFC3"):
                c["nivel"] = "CFGS"
    return ciclos

# ================== Scrape: detalle de ciclo ==================
def parse_info_ciclo(ciclo_url: str) -> Dict[str, Any]:
    soup = get_soup(ciclo_url)
    h2 = soup.find(["h2", "h1"])
    ciclo_nombre = h2.get_text(strip=True) if h2 else ""
    m = re.search(r"codciclo=(IFC\d{3})", ciclo_url)
    ciclo_codigo = m.group(1) if m else ""

    modulos = []
    curso_actual = None
    for node in soup.find_all(["h3", "h2", "a", "div", "p", "li"]):
        tag = node.name
        if tag in ("h3", "h2"):
            t = node.get_text(" ", strip=True)
            if re.search(r"\bcurso\b", t, flags=re.I):
                mcurso = re.search(r"(\d+º)", t)
                curso_actual = mcurso.group(1) if mcurso else t.replace("Curso", "").strip()
        if tag == "a":
            href = node.get("href") or ""
            if "/awc/modulo.php" in href or href.startswith("modulo.php"):
                url = href if href.startswith("http") else urljoin(ciclo_url, href)

                # nombre desde el propio enlace
                nombre = (node.get_text(" ", strip=True) or "").strip()

                # fallback: si viene vacío, intenta leer el h1 del módulo
                if not nombre:
                    try:
                        mod_soup = get_soup(url)
                        h1m = mod_soup.find(["h1", "h2"])
                        titulo_m = h1m.get_text(" ", strip=True) if h1m else ""
                        m2 = re.match(r"^\s*([0-9]{3,4})\.\s*(.+)$", titulo_m)
                        if m2:
                            nombre = m2.group(2).strip()
                        elif titulo_m:
                            nombre = titulo_m.strip()
                    except Exception:
                        pass
                if not nombre:
                    continue

                parent_text = node.parent.get_text(" ", strip=True)
                nums = [int(x) for x in re.findall(r"\b\d+\b", parent_text)]
                horas_sem, horas_tot = None, None
                if len(nums) >= 2:
                    if 0 < nums[0] <= 10 and nums[1] >= 30:
                        horas_sem, horas_tot = nums[0], nums[1]
                    else:
                        horas_tot = nums[-1]

                mcode = re.search(r"cod=(\d{3,4})", href)
                modulo_codigo = mcode.group(1) if mcode else ""
                if not modulo_codigo or not nombre:
                    continue

                modulos.append({
                    "nombre": nombre,
                    "url": url,
                    "curso": curso_actual,
                    "horas_sem": horas_sem,
                    "horas_tot": horas_tot,
                    "codigo": modulo_codigo,
                })
    return {"ciclo_nombre": ciclo_nombre, "ciclo_codigo": ciclo_codigo, "modulos": modulos}



# ================== Scrape: módulo (RA/CE) ==================
def parse_modulo(mod_url: str, ciclo_codigo: str, ciclo_nombre: str, curso_hint: Optional[str]) -> Modulo:
    soup = get_soup(mod_url)

    # Cabecera
    h1 = soup.find(["h1", "h2"])
    titulo = h1.get_text(" ", strip=True) if h1 else ""
    m = re.match(r"^\s*([0-9]{3,4})\.\s*(.+)$", titulo)
    modulo_codigo = m.group(1) if m else ""
    modulo_nombre = m.group(2) if m else titulo

    text_all = soup.get_text("\n", strip=True)
    horas_totales = None
    horas_semanales = None
    creditos = None

    mt = re.search(r"Total:\s*(\d+)\s*horas", text_all, flags=re.I)
    if mt:
        horas_totales = int(mt.group(1))
    ms = re.search(r"(\d+)\s*hora/?semana", text_all, flags=re.I)
    if ms:
        horas_semanales = int(ms.group(1))
    mc = re.search(r"en\s*(\d+º)", text_all, flags=re.I)
    curso = curso_hint or (mc.group(1) if mc else None)

    # Créditos ECTS (si aparecen)
    mects = re.search(r"(\d+(?:[.,]\d+)?)\s*créditos?\s*ects", text_all, flags=re.I)
    if mects:
        num = mects.group(1).replace(",", ".")
        try:
            # lo dejamos como string entero si es .0 (ej. "10"), si no, como "10.5"
            f = float(num)
            creditos = str(int(f)) if abs(f - int(f)) < 1e-6 else str(f)
        except:
            creditos = None

    # RA y CE
    re_ra = re.compile(r"\(?\bRA\s*0*([1-9]\d*)\b\)?(?:\s*[:.\-\u2013])?", re.I)
    re_ce = re.compile(
        r"^[\-\u2022]?\s*((?:[a-zñ]|\d+))\)\s*(.+?)(?=\s(?:[a-zñ]|\d+)\)\s+|$)",
        re.I | re.S
    )

    blocks = list(soup.find_all(['p', 'li', 'div'], recursive=True))

    ralist: List[RA] = []
    ra_current: Optional[RA] = None

    def clean_ra_desc(desc: str) -> str:
        s = re.sub(r"\s+", " ", (desc or "").strip())
        # recorta todo lo anterior a “Resultados de Aprendizaje…”
        s = re.sub(r".*?resultados\s+de\s+aprendizaje.*?criterios\s+de\s+evaluación\s*", "", s, flags=re.I)
        # corta si aparece la primera viñeta (a) o 1))
        s = re.split(r"\s(?:[a-zñ]|\d+)\)\s+", s, maxsplit=1, flags=re.I)[0]
        # limpia restos comunes
        s = re.sub(r"\b(0488\.)?\s*desarrollo de interfaces\b.*?créditos?\s*ects\b", "", s, flags=re.I)
        return s.strip(" .-–—:")

    def finalize_ra():
        nonlocal ra_current
        if ra_current:
            # desduplicar CE por (codigo+descripcion)
            seen = set()
            uniq: List[Criterio] = []
            for ce in ra_current.CE:
                key = (ce.codigo, re.sub(r"\s+", " ", ce.descripcion.strip()))
                if key in seen:
                    continue
                seen.add(key)
                uniq.append(ce)
            ra_current.CE = uniq
            ra_current.descripcion = clean_ra_desc(ra_current.descripcion)
            if ra_current.descripcion or ra_current.CE:
                ralist.append(ra_current)
        ra_current = None

    i = 0
    while i < len(blocks):
        t = blocks[i].get_text(" ", strip=True)
        if not t:
            i += 1
            continue

        mra = re_ra.search(t)
        if mra:
            finalize_ra()
            ra_num = int(mra.group(1))
            raw_desc = re_ra.sub("", t).strip(" .-–—:")
            desc = clean_ra_desc(raw_desc)
            ra_current = RA(codigo=f"RA{ra_num}", descripcion=desc, CE=[])
            i += 1
            while i < len(blocks):
                t2 = blocks[i].get_text(" ", strip=True)
                if not t2:
                    i += 1
                    continue
                if re_ra.search(t2):
                    break
                mce = re_ce.match(t2)
                if mce:
                    etiqueta = mce.group(1).lower()
                    idx = int(etiqueta) if etiqueta.isdigit() else (ord(etiqueta) - ord('a') + 1)
                    ra_num_local = int(ra_current.codigo[2:])
                    ce_code = f"CE{ra_num_local}.{idx}"
                    ce_desc = mce.group(2).strip()
                    ra_current.CE.append(Criterio(codigo=ce_code, descripcion=ce_desc))
                else:
                    if blocks[i].name == "li" and len(t2.split()) > 3 and not t2.lower().startswith("total:"):
                        next_idx = len(ra_current.CE) + 1
                        ra_num_local = int(ra_current.codigo[2:])
                        ce_code = f"CE{ra_num_local}.{next_idx}"
                        ra_current.CE.append(Criterio(codigo=ce_code, descripcion=t2))
                i += 1
            continue

        i += 1

    finalize_ra()

        # ---- POST: fusionar RAs duplicados por mismo código (RA1, RA2, ...) ----
    def _norm(s: str) -> str:
        return re.sub(r"\s+", " ", (s or "").strip())

    merged: Dict[str, RA] = {}
    for ra in ralist:
        key = ra.codigo  # "RA1", "RA2", ...
        if key not in merged:
            merged[key] = RA(codigo=key, descripcion=_norm(ra.descripcion), CE=[])
        else:
            # elegir mejor descripción: prioriza no vacía y más corta (suele ser la limpia)
            cand_a = merged[key].descripcion
            cand_b = _norm(ra.descripcion)
            if cand_b and (not cand_a or len(cand_b) < len(cand_a)):
                merged[key].descripcion = cand_b

        # unir CEs únicos por (codigo + descripcion normalizada)
        seen = {(c.codigo, _norm(c.descripcion)) for c in merged[key].CE}
        for ce in ra.CE:
            k = (ce.codigo, _norm(ce.descripcion))
            if k not in seen:
                merged[key].CE.append(ce)
                seen.add(k)

    # si hay RA con y sin CEs, nos quedamos con el resultante (que ya tiene todos los CEs fusionados)
    ralist = list(merged.values())
    # ordenar por número
    ralist.sort(key=lambda r: int(re.search(r"RA(\d+)", r.codigo).group(1)) if re.search(r"RA(\d+)", r.codigo) else 999)


    return Modulo(
        codigo=modulo_codigo,
        nombre=modulo_nombre,
        ciclo_codigo=ciclo_codigo,
        ciclo_nombre=ciclo_nombre,
        curso=curso,
        horas_totales=horas_totales,
        horas_semanales=horas_semanales,
        creditos=creditos,
        RA=ralist
    )

# ================== Scrape: todo IFC ==================
def scrape_ifc() -> List[Ciclo]:
    ciclos_info = parse_ciclos_ifc()
    ciclos: List[Ciclo] = []
    for c in ciclos_info:
        print(f"[+] Ciclo: {c['nombre']} ({c['codigo']}) - {c['nivel']}")
        time.sleep(SLEEP[0])
        inf = parse_info_ciclo(c["url"])
        mods: List[Modulo] = []
        for m in inf["modulos"]:
            print(f"    - Módulo: {m['codigo']} {m['nombre']} [{m['curso']}]")
            time.sleep(SLEEP[0])
            try:
                mod = parse_modulo(m["url"], inf["ciclo_codigo"], inf["ciclo_nombre"], m["curso"])
                mods.append(mod)
            except Exception as e:
                print(f"      ! Error al parsear módulo {m.get('codigo','?')} -> {e}")
            time.sleep(SLEEP[1])
        ciclos.append(Ciclo(
            codigo=inf["ciclo_codigo"],
            nombre=inf["ciclo_nombre"],
            nivel=c["nivel"],
            modulos=mods
        ))
    return ciclos

# ================== Transformación a MODELO CORRECTO (legacy) ==================
def to_legacy(ciclos: List[Ciclo]) -> List[Dict[str, Any]]:
    """Convierte ciclos->módulos a lista plana de asignaturas con esquema legacy."""
    def norm(s): return (s or "").strip()
    legacy = []
    for c in ciclos:
        for m in c.modulos:
            if not norm(m.codigo) or not norm(m.nombre):
                continue
            legacy.append({
                "id": norm(m.codigo),
                "nombre": norm(m.nombre),
                "creditos": (m.creditos if m.creditos is not None else None),
                "descripcion": {
                    "duracion": (f"{m.horas_totales}h" if m.horas_totales is not None else None),
                    "centro": None,
                    "empresa": None
                },
                "CE": [],
                "RA": [
                    {
                        "codigo": ra.codigo,
                        "descripcion": ra.descripcion,
                        "CE": [asdict(ce) for ce in ra.CE]
                    } for ra in m.RA
                ]
            })
    # Desambiguar duplicados por (id,nombre): nos quedamos con el que más RA/CE tenga
    by_key: Dict[str, Dict[str, Any]] = {}
    def score(a):
        return len(a.get("RA", [])) + sum(len(x.get("CE", [])) for x in a.get("RA", []))
    for a in legacy:
        k = f"{a['id']}::{a['nombre'].lower()}"
        prev = by_key.get(k)
        if (not prev) or score(a) > score(prev):
            by_key[k] = a
    deduped = list(by_key.values())
    deduped.sort(key=lambda x: (int(x["id"]) if x["id"].isdigit() else 99999, x["nombre"]))
    return deduped

# ================== Main ==================
if __name__ == "__main__":
    ciclos = scrape_ifc()
    # Genera directamente el JSON que TU APP espera
    asignaturas_legacy = to_legacy(ciclos)

    os.makedirs("public", exist_ok=True)
    out_path = os.path.join("public", "asignaturas_FP.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(asignaturas_legacy, f, ensure_ascii=False, indent=2)
    print(f"✅ Guardado {out_path} con {len(asignaturas_legacy)} asignaturas (modelo legacy).")
