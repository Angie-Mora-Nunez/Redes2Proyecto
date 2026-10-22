import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';

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
}