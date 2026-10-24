import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Vista } from '../models/game.models';

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

@Injectable({ providedIn: 'root' })
export class PartidaService {
private apiUrl = localStorage.getItem('democraxssy-servidor') ?? '';
private sesionActual: SesionPartida | null = null;

  constructor(private http: HttpClient) {}

  // Conexión al servidor.
comprobarServicio(direccion: string): Observable<void> {
  const urlApi = this.prepararDireccion(direccion);
  return this.http.head<void>(`${urlApi}/salud`);
}

  guardarServidor(direccion: string): void {
  const nuevaApiUrl = this.prepararDireccion(direccion);
  if (nuevaApiUrl !== this.apiUrl) {
    this.limpiarSesion();
  }
  this.apiUrl = nuevaApiUrl;
  localStorage.setItem('democraxssy-servidor', this.apiUrl);
}

  obtenerServidor(): string {
    return this.apiUrl;
  }

  private prepararDireccion(direccion: string): string {
    try {
      const url = new URL(direccion.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Protocolo no válido.');
      }
      return `${url.origin}/api`;
    } catch {
      throw new Error('Ingresá una dirección válida que comience con http:// o https://.');
    }
  }

  // Crear y unirse.
  crearPartida(nombre: string, puntosParaGanar: number): Observable<RespuestaCrearPartida> {
    return this.http.post<RespuestaCrearPartida>(
      `${this.apiUrl}/partidas`,
      {
        nombre: nombre.trim(),
        puntos_para_ganar: puntosParaGanar
      }
    );
  }

  unirsePartida(id: string, nombre: string): Observable<RespuestaCrearPartida> {
    const idSinEspacios = id.trim();
    const codigo = encodeURIComponent(idSinEspacios);
    return this.http.post<RespuestaCrearPartida>(
      `${this.apiUrl}/partidas/${codigo}/jugadores`,
      { nombre: nombre.trim() }
    );
  }

  // Acciones de la partida.
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

  // Sesión del jugador.
  guardarSesion(respuesta: RespuestaCrearPartida): void {
    this.sesionActual = {
      partidaId: respuesta.partida_id,
      jugadorId: respuesta.jugador_id,
      token: respuesta.token,
      partida: respuesta.partida
    };
    sessionStorage.setItem('democraxssy-sesion', JSON.stringify(this.sesionActual));
  }

  obtenerSesion(): SesionPartida | null {
    if (this.sesionActual) {
      return this.sesionActual;
    }
    const guardada = sessionStorage.getItem('democraxssy-sesion');
    if (guardada === null) {
      return null;
    }
    try {
      this.sesionActual = JSON.parse(guardada);
      return this.sesionActual;
    } catch {
      this.limpiarSesion();
      return null;
    }
  }

  haySesion(): boolean {
    const sesion = this.obtenerSesion();
    return !!sesion?.partidaId && !!sesion?.jugadorId && !!sesion?.token;
  }

  obtenerHeadersAutorizacion(): HttpHeaders {
    const sesion = this.obtenerSesion();
    if (!sesion?.token) {
      throw new Error('No hay una sesión de jugador disponible.');
    }
    return new HttpHeaders({
      Authorization: `Bearer ${sesion.token}`
    });
  }

  limpiarSesion(): void {
    this.sesionActual = null;
    sessionStorage.removeItem('democraxssy-sesion');
  }

  private urlPartida(ruta: string): string {
    const sesion = this.obtenerSesion();
    if (!sesion?.partidaId) {
      throw new Error('No hay una partida guardada.');
    }
    const codigo = encodeURIComponent(sesion.partidaId);
    return `${this.apiUrl}/partidas/${codigo}${ruta}`;
  }
}

export function obtenerMensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revisá la dirección y tu conexión.';
    }
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return `El servidor respondió con el error ${error.status}.`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}