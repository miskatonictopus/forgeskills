// main/backups.ts
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import Database from "better-sqlite3";

export type BackupKind = "INC" | "FULL";
export type BackupInfo = { kind: BackupKind; file: string; ts: string; size: number };

const PAD = (n: number) => String(n).padStart(2, "0");
const tsNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}_${PAD(d.getHours())}-${PAD(d.getMinutes())}`;
};

export class BackupManager {
  constructor(
    private dbPath: string,
    private outRoot = path.join(os.homedir(), "Documents", "SkillForgeBackups"),
  ) {}

  INC_KEEP = 12;   // ≈4h de incrementales
  FULL_KEEP = 48;  // ≈2 días de completos

  private ensure(dir: string) { fs.mkdirSync(dir, { recursive: true }); }
  private dayDir(d = new Date()) {
    const name = `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
    return path.join(this.outRoot, name);
  }

  private async gzipFile(src: string) {
    const dest = `${src}.gz`;
    await pipeline(fs.createReadStream(src), zlib.createGzip({ level: 9 }), fs.createWriteStream(dest));
    await fsp.rm(src, { force: true });
    return dest;
  }

  private listAll(kind?: BackupKind): BackupInfo[] {
    if (!fs.existsSync(this.outRoot)) return [];
    const out: BackupInfo[] = [];
    for (const day of fs.readdirSync(this.outRoot)) {
      const dir = path.join(this.outRoot, day);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir)) {
        const m = f.match(/^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2})_(INC|FULL)\.sqlite\.gz$/);
        if (!m) continue;
        const [, ts, k] = m;
        if (kind && k !== kind) continue;
        const full = path.join(dir, f);
        out.push({ kind: k as BackupKind, file: full, ts, size: fs.statSync(full).size });
      }
    }
    out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return out;
  }

  list(kind?: BackupKind) { return this.listAll(kind); }

  /** Snapshot coherente de SQLite usando VACUUM INTO. */
  private async snapshotTo(outFile: string) {
    const db = new Database(this.dbPath);
    try {
      const safe = outFile.replace(/'/g, "''");
      db.prepare(`VACUUM INTO '${safe}'`).run();
    } finally {
      db.close();
    }
  }

  async backup(kind: BackupKind): Promise<BackupInfo> {
    this.ensure(this.outRoot);
    const perDay = this.dayDir();
    this.ensure(perDay);
    const stamp = tsNow();
    const raw = path.join(perDay, `${stamp}_${kind}.sqlite`);
    await this.snapshotTo(raw);
    const gz = await this.gzipFile(raw);
    const size = (await fsp.stat(gz)).size;
    await this.rotate();
    return { kind, file: gz, ts: stamp, size };
  }

  private async rotate() {
    const inc = this.listAll("INC");
    const full = this.listAll("FULL");
    const drop = (arr: BackupInfo[], keep: number) => (arr.length > keep ? arr.slice(keep) : []);
    for (const it of [...drop(inc, this.INC_KEEP), ...drop(full, this.FULL_KEEP)]) {
      await fsp.rm(it.file, { force: true });
      const dir = path.dirname(it.file);
      try {
        if ((await fsp.readdir(dir)).length === 0) await fsp.rm(dir, { recursive: true, force: true });
      } catch {}
    }
  }

  /** Restaurar: sustituye la DB actual por el backup seleccionado. */
  async restore(gzPath: string) {
    const tmp = path.join(path.dirname(this.dbPath), `.__restore_${Date.now()}.sqlite`);
    await pipeline(fs.createReadStream(gzPath), zlib.createGunzip(), fs.createWriteStream(tmp));
    await fsp.copyFile(tmp, this.dbPath);
    await fsp.rm(tmp, { force: true });
  }
}
