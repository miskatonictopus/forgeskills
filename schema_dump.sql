CREATE TABLE cursos (
      id TEXT PRIMARY KEY,
      acronimo TEXT,
      nombre TEXT,
      nivel TEXT,
      grado TEXT,
      clase TEXT
    );
CREATE TABLE nombres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT
    );
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE asignaturas (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      creditos TEXT,
      descripcion TEXT, 
      RA TEXT           
    , color TEXT DEFAULT '#4B5563');
CREATE TABLE alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    apellidos TEXT,
    curso TEXT,
    mail TEXT
  );
CREATE TABLE horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asignatura_id TEXT NOT NULL,
    dia TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL
  , curso_id TEXT, created_at TEXT);
CREATE TABLE curso_asignatura (
  curso_id TEXT NOT NULL,
  asignatura_id TEXT NOT NULL,
  PRIMARY KEY (curso_id, asignatura_id),
  FOREIGN KEY (curso_id) REFERENCES cursos(id),
  FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id)
);
CREATE TABLE actividades (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    fecha TEXT NOT NULL,
    curso_id TEXT NOT NULL,
    asignatura_id TEXT NOT NULL, descripcion TEXT, estado TEXT NOT NULL DEFAULT 'borrador', umbral_aplicado INTEGER, analisis_fecha TEXT, programada_para TEXT, programada_fin TEXT, evaluada_fecha TEXT,
    FOREIGN KEY (curso_id) REFERENCES cursos(id),
    FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id)
  );
CREATE TABLE ra (
    id TEXT PRIMARY KEY,
    codigo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    asignatura_id TEXT NOT NULL,
    FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id) ON DELETE CASCADE
);
CREATE TABLE ce (
    id TEXT PRIMARY KEY,
    codigo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    ra_id TEXT NOT NULL,
    FOREIGN KEY (ra_id) REFERENCES ra(id) ON DELETE CASCADE
);
CREATE TABLE actividad_ce (
      actividad_id TEXT NOT NULL,
      ce_codigo TEXT NOT NULL,
      puntuacion REAL NOT NULL,
      razon TEXT,
      evidencias TEXT,
      incluido INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (actividad_id, ce_codigo)
    );
CREATE TABLE actividad_estado_historial (
      id TEXT PRIMARY KEY,
      actividad_id TEXT NOT NULL,
      estado TEXT NOT NULL,
      fecha TEXT NOT NULL,
      meta TEXT
    );
CREATE INDEX idx_horarios_curso_asig ON horarios(curso_id, asignatura_id);
CREATE UNIQUE INDEX ux_horario ON horarios(curso_id, asignatura_id, dia, hora_inicio, hora_fin);
CREATE TABLE rango_lectivo (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  start TEXT NOT NULL,     -- "YYYY-MM-DD"
  end   TEXT NOT NULL,     -- "YYYY-MM-DD"
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE festivos (
  id TEXT PRIMARY KEY,          -- uuid
  start TEXT NOT NULL,          -- "YYYY-MM-DD"
  end   TEXT,                   -- opcional ("YYYY-MM-DD"), si es NULL se toma como start
  title TEXT NOT NULL,          -- motivo
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_festivos_start ON festivos (start);
CREATE UNIQUE INDEX unq_festivos_start_end_title
ON festivos (start, COALESCE(end, start), title);
CREATE TABLE presencialidades (
  id TEXT PRIMARY KEY,          -- uuid
  dia_semana INTEGER NOT NULL,  -- 1..5 (o 0..6 si incluyes finde)  L=1
  hora_inicio TEXT NOT NULL,    -- "HH:MM"
  hora_fin    TEXT NOT NULL,    -- "HH:MM"
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX unq_presencial_dia_horas
ON presencialidades (dia_semana, hora_inicio, hora_fin);
CREATE TABLE fct_tramos (
  id TEXT PRIMARY KEY,
  dia_semana INTEGER NOT NULL,  -- 1..5 (L..V) (usa 0..6 si también hay finde)
  hora_inicio TEXT NOT NULL,    -- "HH:MM"
  hora_fin    TEXT NOT NULL,    -- "HH:MM"
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX unq_fct_dia_horas
ON fct_tramos (dia_semana, hora_inicio, hora_fin);
CREATE INDEX idx_horarios_curso_asig_dia
    ON horarios(curso_id, asignatura_id, dia, hora_inicio, hora_fin)
  ;
CREATE INDEX idx_actividades_prog
    ON actividades(curso_id, programada_para, programada_fin)
  ;
CREATE INDEX idx_actividades_estado_fecha
ON actividades (estado, fecha);
CREATE TABLE IF NOT EXISTS "actividad_nota_old" (
  actividad_id TEXT NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  alumno_id    INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  nota         REAL NOT NULL CHECK (nota >= 0 AND nota <= 10),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (actividad_id, alumno_id)
);
CREATE TABLE nota_ce (
  alumno_id     INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  asignatura_id TEXT    NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
  ce_codigo     TEXT    NOT NULL,
  nota          REAL    NOT NULL CHECK (nota >= 0 AND nota <= 10),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (alumno_id, asignatura_id, ce_codigo)
);
CREATE INDEX idx_nota_ce_asignatura ON nota_ce (asignatura_id);
CREATE TABLE actividad_nota (
  id TEXT PRIMARY KEY,
  actividad_id TEXT NOT NULL,
  alumno_id TEXT NOT NULL,
  nota REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (actividad_id, alumno_id)
);
CREATE INDEX idx_actividad_nota_actividad ON actividad_nota(actividad_id);
CREATE INDEX idx_actividad_ce_actividad ON actividad_ce(actividad_id);
CREATE INDEX idx_nota_ce_al_asig_ce ON nota_ce(alumno_id, asignatura_id, ce_codigo);
CREATE INDEX idx_actividades_estado_programada
    ON actividades (estado, programada_para)
  ;
CREATE TABLE alumno_ce (
  id TEXT PRIMARY KEY,
  alumno_id TEXT NOT NULL,
  ce_codigo TEXT NOT NULL,
  actividad_id TEXT NOT NULL,
  nota REAL NOT NULL,
  UNIQUE(alumno_id, ce_codigo, actividad_id)
);
