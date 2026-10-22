export const Fase = {
  SALA: 'sala',
  RESPUESTAS: 'respuestas',
  VOTACION: 'votacion',
  DECISION: 'decision',
  RESULTADO: 'resultado',
  TERMINADA: 'terminada',
} as const;

export type Fase = (typeof Fase)[keyof typeof Fase];

export interface JugadorPublico {
  id: string;
  nombre: string;
  puntos: number;
  es_anfitrion: boolean;
  es_soberano: boolean;
  ya_respondio: boolean;
  ya_voto: boolean;
}

export interface CartaNegra {
  texto: string;
  elegir: number;
}

export interface RespuestaRevelada {
  id: string;
  cartas: string[];
  frase: string;
  es_mia: boolean;
  votos: number;
  autor_id: string;
}

export interface Ronda {
  numero: number;
  soberano_id: string;
  carta_negra: CartaNegra;
  respuestas_recibidas: number;
  votos_emitidos: number;
  respuestas: RespuestaRevelada[];
  favoritas_del_pueblo: string[];
  ganadora: string | null;
}

export interface CartaBlanca {
  id: number;
  texto: string;
}

export interface Yo {
  id: string;
  nombre: string;
  mano: CartaBlanca[];
  mi_voto: string | null;
  puede_avanzar: boolean;
}

export interface ResumenRonda {
  numero: number;
  soberano_id: string;
  ganador_id: string;
  frase: string;
  respeto_al_pueblo: boolean;
}

export interface Vista {
  id: string;
  fase: Fase;
  anfitrion_id: string;
  puntos_para_ganar: number;
  jugadores: JugadorPublico[];
  ronda: Ronda | null;
  yo: Yo | null;
  historial: ResumenRonda[];
  ganador_id: string | null;
}

export interface Sesion {
  partida_id: string;
  jugador_id: string;
  token: string;
  partida: Vista;
}