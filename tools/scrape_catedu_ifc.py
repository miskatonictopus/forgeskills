import json
import re
import time
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE = "https://centrosdocentes.catedu.es"
FAMILIA_URL = f"{BASE}/awc/public/pages/familias/ciclos.php?familia=IFC"
HEADERS = {
    "User-Agent": "SkillForgeScraper/1.0 (+https://skillforge.local) Python-requests",
    "Accept-Language": "es-ES,es;q=0.9",
}
SLEEP = (0.5, 1.2)

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
    RA: List[RA]

@dataclass
class Ciclo:
    codigo: str
    nombre: str
    nivel: str
    modulos: List[Modulo]

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

def parse_ciclos_ifc() -> List[Dict[str, str]]:
    soup = get_soup(FAMILIA_URL)
    links = soup.find_all("a", href=re.compile(r"info_ciclo\.php\?codciclo=IFC\d+"))
    ciclos = []
    for a in links:
        href = (a.get("href") or "").strip()
        if not href:
            continue
        # Construcción de URL robusta
        url = href if href.startswith("http") else urljoin(FAMILIA_URL, href)

        text = a.get_text(" ", strip=True)
        m = re.search(r"(IFC\d{3})", text)
        codigo = m.group(1) if m else ""
        nombre = text.replace(codigo, "").strip(" -—·\u00A0")
        nivel = "Desconocido"

        # Inferir nivel por contexto cercano
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
                # queda como "1º", "2º", etc.
                mcurso = re.search(r"(\d+º)", t)
                curso_actual = mcurso.group(1) if mcurso else t.replace("Curso", "").strip()
        if tag == "a":
            href = node.get("href") or ""
            if "/awc/modulo.php" in href or href.startswith("modulo.php"):
                nombre = node.get_text(" ", strip=True)
                url = href if href.startswith("http") else urljoin(ciclo_url, href)

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

                modulos.append({
                    "nombre": nombre,
                    "url": url,
                    "curso": curso_actual,
                    "horas_sem": horas_sem,
                    "horas_tot": horas_tot,
                    "codigo": modulo_codigo,
                })
    return {"ciclo_nombre": ciclo_nombre, "ciclo_codigo": ciclo_codigo, "modulos": modulos}

def parse_modulo(mod_url: str, ciclo_codigo: str, ciclo_nombre: str, curso_hint: Optional[str]) -> Modulo:
    soup = get_soup(mod_url)

    # --- Cabecera: código y nombre del módulo ---
    h1 = soup.find(["h1", "h2"])
    titulo = h1.get_text(" ", strip=True) if h1 else ""
    m = re.match(r"^\s*([0-9]{3,4})\.\s*(.+)$", titulo)
    modulo_codigo = m.group(1) if m else ""
    modulo_nombre = m.group(2) if m else titulo

    # --- Horas / curso ---
    text_all = soup.get_text("\n", strip=True)
    horas_totales = None
    horas_semanales = None
    mt = re.search(r"Total:\s*(\d+)\s*horas", text_all, flags=re.I)
    if mt:
        horas_totales = int(mt.group(1))
    ms = re.search(r"(\d+)\s*hora/?semana", text_all, flags=re.I)
    if ms:
        horas_semanales = int(ms.group(1))
    curso = curso_hint
    mc = re.search(r"en\s*(\d+º)", text_all, flags=re.I)
    if mc:
        curso = mc.group(1)

    # --- RA + CE ---
    # RA puede aparecer como: "(RA1)", "RA1:", "RA1.", "RA 1 -", etc.
    re_ra = re.compile(r"\(?\bRA\s*0*([1-9]\d*)\b\)?(?:\s*[:.\-\u2013])?", re.I)
    # CE puede ser letra o número: "a) ...", "b) ...", "1) ...", "2) ..."
    re_ce = re.compile(r"^[\-\u2022]?\s*((?:[a-zñ]|[0-9]+))\)\s*(.+)$", re.I)

    # Trabajamos con elementos de bloque en orden de aparición
    blocks = list(soup.find_all(['p', 'li', 'div'], recursive=True))

    ralist: List[RA] = []
    ra_current: Optional[RA] = None

    def finalize_ra():
        nonlocal ra_current
        if ra_current:
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
            # Cerramos el RA previo (si lo hubiera)
            finalize_ra()
            ra_num = int(mra.group(1))
            # Descripción del RA = el texto de este bloque sin el marcador "RAx"
            desc = re_ra.sub("", t).strip(" .-–—:")
            ra_current = RA(codigo=f"RA{ra_num}", descripcion=desc, CE=[])
            i += 1
            # Consumimos siguientes bloques como parte del RA hasta el próximo RA
            while i < len(blocks):
                t2 = blocks[i].get_text(" ", strip=True)
                if not t2:
                    i += 1
                    continue
                # ¿Empieza un nuevo RA? entonces paramos
                if re_ra.search(t2):
                    break

                mce = re_ce.match(t2)
                if mce:
                    etiqueta = mce.group(1).lower()
                    # Mapear letra -> índice; si es número, usarlo tal cual
                    if etiqueta.isdigit():
                        idx = int(etiqueta)
                    else:
                        idx = ord(etiqueta) - ord('a') + 1
                    ra_num_local = int(ra_current.codigo[2:])
                    ce_code = f"CE{ra_num_local}.{idx}"
                    ra_current.CE.append(Criterio(codigo=ce_code, descripcion=mce.group(2).strip()))
                else:
                    # Fallback: si es un <li> dentro del bloque del RA, considéralo CE secuencial
                    if blocks[i].name == "li" and len(t2.split()) > 3 and not t2.lower().startswith("total:"):
                        next_idx = len(ra_current.CE) + 1
                        ra_num_local = int(ra_current.codigo[2:])
                        ce_code = f"CE{ra_num_local}.{next_idx}"
                        ra_current.CE.append(Criterio(codigo=ce_code, descripcion=t2))
                i += 1
            # no incrementes i aquí; el while externo revisará el bloque del siguiente RA
            continue

        i += 1

    finalize_ra()

    return Modulo(
        codigo=modulo_codigo,
        nombre=modulo_nombre,
        ciclo_codigo=ciclo_codigo,
        ciclo_nombre=ciclo_nombre,
        curso=curso,
        horas_totales=horas_totales,
        horas_semanales=horas_semanales,
        RA=ralist
    )


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

def to_serializable(ciclos: List[Ciclo]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for c in ciclos:
        out.append({
            "ciclo": c.nombre,
            "codigo": c.codigo,
            "nivel": c.nivel,
            "modulos": [
                {
                    "codigo": m.codigo,
                    "nombre": m.nombre,
                    "ciclo_codigo": m.ciclo_codigo,
                    "ciclo_nombre": m.ciclo_nombre,
                    "curso": m.curso,
                    "horas_totales": m.horas_totales,
                    "horas_semanales": m.horas_semanales,
                    "RA": [
                        {"codigo": ra.codigo, "descripcion": ra.descripcion,
                         "CE": [asdict(ce) for ce in ra.CE]}
                        for ra in m.RA
                    ]
                } for m in c.modulos
            ]
        })
    return out

if __name__ == "__main__":
    ciclos = scrape_ifc()
    data = to_serializable(ciclos)
    with open("ifc_catedu.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("✅ Guardado ifc_catedu.json")
