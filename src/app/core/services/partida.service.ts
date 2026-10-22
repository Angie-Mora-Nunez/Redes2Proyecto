import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Vista } from '../models/game.models';

const API_URL =
  'https://democraxssy.akamai.meseguercr.com/api';

export interface RespuestaCrearPartida {
  partida_id: string;
  jugador_id: string;
  token: string;
  partida: {
    id: string;
    fase: string;
    anfitrion_id: string;
    puntos_para_ganar: number;
    jugadores: Array<{
      id: string;
      nombre: string;
      puntos: number;
      es_anfitrion: boolean;
      es_soberano: boolean;
      ya_respondio: boolean;
      ya_voto: boolean;
    }>;
    yo: {
      id: string;
      nombre: string;
      mano: unknown[];
      mi_voto: string | null;
      puede_avanzar: boolean;
    };
    ronda: unknown | null;
    historial: unknown[];
    ganador_id: string | null;
  };
}

export interface SesionPartida {
  partidaId: string;
  jugadorId: string;
  token: string;
  partida: RespuestaCrearPartida['partida'];
}

@Injectable({
  providedIn: 'root'
})
export class PartidaService {
  private sesionActual: SesionPartida | null = null;

  constructor(private http: HttpClient) {}

  comprobarServicio(): Observable<void> {
    return this.http.head<void>(`${API_URL}/salud`);
  }

  crearPartida(
    nombre: string,
    puntosParaGanar = 5
  ): Observable<RespuestaCrearPartida> {
    return this.http.post<RespuestaCrearPartida>(
      `${API_URL}/partidas`,
      {
        nombre,
        puntos_para_ganar: puntosParaGanar
      }
    ).pipe(
      tap(respuesta => {
        this.guardarSesion(respuesta);
      })
    );
  }

  unirsePartida(
  id: string,
  nombre: string
): Observable<RespuestaCrearPartida> {
  return this.http.post<RespuestaCrearPartida>(
    `${API_URL}/partidas/${encodeURIComponent(id)}/jugadores`,
    { nombre }
  ).pipe(
    tap(respuesta => this.guardarSesion(respuesta))
  );
}

  // ---------- Rutas con token (pantalla de juego) ----------

  obtener(): Observable<Vista> {
    return this.http.get<Vista>(
      this.urlPartida(''),
      { headers: this.obtenerHeadersAutorizacion() }
    );
  }

  iniciar(): Observable<Vista> {
    return this.http.post<Vista>(
      this.urlPartida('/iniciar'),
      {},
      { headers: this.obtenerHeadersAutorizacion() }
    );
  }

  enviarRespuesta(cartas: number[]): Observable<Vista> {
    return this.http.put<Vista>(
      this.urlPartida('/respuestas'),
      { cartas },
      { headers: this.obtenerHeadersAutorizacion() }
    );
  }

  votar(respuestaId: string): Observable<Vista> {
    return this.http.put<Vista>(
      this.urlPartida('/votos'),
      { respuesta_id: respuestaId },
      { headers: this.obtenerHeadersAutorizacion() }
    );
  }

  decidir(respuestaId: string): Observable<Vista> {
    return this.http.post<Vista>(
      this.urlPartida('/decision'),
      { respuesta_id: respuestaId },
      { headers: this.obtenerHeadersAutorizacion() }
    );
  }

  avanzar(): Observable<Vista> {
    return this.http.post<Vista>(
      this.urlPartida('/avanzar'),
      {},
      { headers: this.obtenerHeadersAutorizacion() }
    );
  }

  eliminar(): Observable<void> {
    return this.http.delete<void>(
      this.urlPartida(''),
      { headers: this.obtenerHeadersAutorizacion() }
    );
  }

  // ---------- Sesión ----------

  private guardarSesion(
    respuesta: RespuestaCrearPartida
  ): void {
    this.sesionActual = {
      partidaId: respuesta.partida_id,
      jugadorId: respuesta.jugador_id,
      token: respuesta.token,
      partida: respuesta.partida
    };

    sessionStorage.setItem(
      'democraxssy-sesion',
      JSON.stringify(this.sesionActual)
    );
  }

  obtenerSesion(): SesionPartida | null {
    if (this.sesionActual) {
      return this.sesionActual;
    }

    const guardada = sessionStorage.getItem(
      'democraxssy-sesion'
    );

    if (!guardada) {
      return null;
    }

    try {
      this.sesionActual = JSON.parse(guardada) as SesionPartida;
      return this.sesionActual;
    } catch {
      sessionStorage.removeItem('democraxssy-sesion');
      return null;
    }
  }

  /** true si hay lo mínimo para jugar: partida y token. */
  haySesion(): boolean {
    const sesion = this.obtenerSesion();
    return !!sesion?.token && !!sesion?.partidaId;
  }

  obtenerHeadersAutorizacion(): HttpHeaders {
    const sesion = this.obtenerSesion();

    if (!sesion?.token) {
      throw new Error('No hay un token de sesión disponible.');
    }

    return new HttpHeaders({
      Authorization: `Bearer ${sesion.token}`
    });
  }

  limpiarSesion(): void {
    this.sesionActual = null;
    sessionStorage.removeItem('democraxssy-sesion');
  }

  // ---------- Internos ----------

  private urlPartida(ruta: string): string {
    const id = encodeURIComponent(this.obtenerSesion()?.partidaId ?? '');
    return `${API_URL}/partidas/${id}${ruta}`;
  }
}

/** Convierte cualquier error HTTP en un mensaje legible para el usuario. */
export function obtenerMensajeDeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa la dirección del backend.';
    }
    const cuerpo = err.error as { error?: string } | null;
    return cuerpo?.error ?? `Error ${err.status}`;
  }
  return 'Ocurrió un error inesperado.';
}