import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import {
  PartidaService,
  RespuestaCrearPartida,
  obtenerMensajeDeError
} from '../../core/services/partida.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  direccionServidor = '';
  nombreJugador = '';
  codigoPartida = '';
  puntosParaGanar: number | null = null;
  cargando = false;
  servicioDisponible = false;
  mensajeError = '';
  mensajeExito = '';
  opcion = '';
  private direccionConectada = '';

  constructor(
    private partidaService: PartidaService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.direccionServidor = this.partidaService.obtenerServidor();
  }

  conectar(): void {
    if (this.cargando) {
      return;
    }
    this.limpiarMensajes();
    this.servicioDisponible = false;
    const direccion = this.direccionServidor.trim();

    if (!direccion) {
      this.mensajeError = 'Ingresá la dirección del servidor.';
      return;
    }

    this.cargando = true;
    try {
      this.partidaService.comprobarServicio(direccion).subscribe({
        next: () => {
          try {
            this.partidaService.guardarServidor(direccion);
          } catch (error) {
            this.mostrarError(error);
            return;
          }
          this.direccionServidor = direccion;
          this.direccionConectada = direccion;
          this.servicioDisponible = true;
          this.cargando = false;
          this.mensajeExito = 'Conectado al servidor.';
          console.log('Conexión correcta.');
          this.cdr.markForCheck();
        },
        error: (error) => this.mostrarError(error)
      });
    } catch (error) {
      this.mostrarError(error);
    }
  }

  crearPartida(): void {
    if (this.cargando) {
      return;
    }
    this.limpiarMensajes();
    if (!this.validarIngreso()) {
      return;
    }

    const puntos = this.puntosParaGanar;
    if (
      puntos === null ||
      !Number.isInteger(puntos) ||
      puntos < 1 ||
      puntos > 20
    ) {
      this.mensajeError = 'Ingresá un número entero entre 1 y 20 para los puntos.';
      return;
    }

    this.cargando = true;
    this.partidaService.crearPartida(this.nombreJugador, puntos).subscribe({
      next: (respuesta) => {
        this.entrarAlLobby(respuesta, 'Partida creada.');
      },
      error: (error) => this.mostrarError(error)
    });
  }

  unirsePartida(): void {
    if (this.cargando) {
      return;
    }
    this.limpiarMensajes();
    if (!this.validarIngreso()) {
      return;
    }

    this.codigoPartida = this.codigoPartida.trim();
    if (!this.codigoPartida) {
      this.mensajeError = 'Ingresá el código de la partida.';
      return;
    }

    this.cargando = true;
    this.partidaService.unirsePartida(
      this.codigoPartida,
      this.nombreJugador
    ).subscribe({
      next: (respuesta) => {
        this.entrarAlLobby(respuesta, 'Te uniste a la partida.');
      },
      error: (error) => this.mostrarError(error)
    });
  }

  // Validación compartida por crear y unirse.
  private validarIngreso(): boolean {
    if (
      !this.servicioDisponible ||
      this.direccionServidor.trim() !== this.direccionConectada
    ) {
      this.servicioDisponible = false;
      this.mensajeError = 'Primero conectate al servidor.';
      return false;
    }

    this.nombreJugador = this.nombreJugador.trim();
    if (this.nombreJugador.length < 1 || this.nombreJugador.length > 24) {
      this.mensajeError = 'El nombre debe tener entre 1 y 24 caracteres.';
      return false;
    }
    return true;
  }

  private entrarAlLobby(respuesta: RespuestaCrearPartida, mensaje: string): void {
    try {
      this.partidaService.guardarSesion(respuesta);
    } catch (error) {
      this.mostrarError(error);
      return;
    }
    this.cargando = false;
    this.mensajeExito = mensaje;
    console.log(mensaje, 'Código:', respuesta.partida_id);
    this.cdr.markForCheck();
    this.router.navigate(['/lobby']);
  }

  private mostrarError(error: unknown): void {
    this.cargando = false;
    this.mensajeExito = '';
    this.mensajeError = obtenerMensajeDeError(error);
    console.error(this.mensajeError);
    this.cdr.markForCheck();
  }

  private limpiarMensajes(): void {
    this.mensajeError = '';
    this.mensajeExito = '';
  }
  
  cambiarOpcion(opcion: string): void {
  if (this.cargando) {
    return;
  }
  this.opcion = opcion;
  this.limpiarMensajes();
}
}