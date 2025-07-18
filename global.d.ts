export {};

declare global {
  interface Window {
    electronAPI: {
      guardarNombre: (nombre: string) => Promise<void>;
      leerNombres: () => Promise<string[]>;
      leerAsignaturas: () => Promise<any[]>;
      guardarAsignatura: (asignatura: {
        id: string;
        nombre: string;
        creditos: string;
        descripcion: {
          duracion: string;
          centro: string;
          empresa: string;
        };
        RA: {
          codigo: string;
          descripcion: string;
          CE: { codigo: string; descripcion: string }[];
        }[];
      }) => Promise<void>;
      guardarCurso: (curso: {
        acronimo: string;
        nombre: string;
        nivel: string;
        grado: string;
        clase: string;
      }) => Promise<void>;
      leerCursos: () => Promise<any[]>;
      borrarCurso: (id: string) => Promise<void>;
      guardarAlumno: (alumno: {
        nombre: string;
        curso: string;
      }) => Promise<void>;
      leerAlumnos: () => Promise<any[]>;
      guardarHorario: (horario: {
        asignaturaId: string;
        dia: string;
        horaInicio: string;
        horaFin: string;
      }) => Promise<void>;
      leerHorarios: (asignaturaId: string) => Promise<Horario[]>;
      leerHorariosTodos: () => Promise<
        {
          asignaturaId: string;
          dia: string;
          horaInicio: string;
          horaFin: string;
        }[]
      >;
      borrarHorario: (datos: {
        asignaturaId: string;
        dia: string;
        horaInicio: string;
      }) => Promise<void>;
    };
  }

  type Horario = {
    dia: string;
    horaInicio: string;
    horaFin: string;
  };
}
