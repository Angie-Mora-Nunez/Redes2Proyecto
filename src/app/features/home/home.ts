
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { finalize } from 'rxjs';

import { PartidaService } from '../../core/services/partida.service';
import { ChangeDetectorRef } from '@angular/core';

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
  nombreJugador = '';
  codigoPartida = '';

  cargando = false;
  servicioDisponible = false;

  mensajeError = '';
  mensajeExito = '';

constructor(
  private partidaService: PartidaService,
  private cdr: ChangeDetectorRef
) {}

  ngOnInit(): void {
    this.comprobarServicio();
  }

  comprobarServicio(): void {
    this.partidaService.comprobarServicio().subscribe({
      next: () => {
        this.servicioDisponible = true;
      },
      error: () => {
        this.servicioDisponible = false;
      }
    });
  }

  private validarNombre(): boolean {
    const nombre = this.nombreJugador.trim();

    if (nombre.length < 1 || nombre.length > 24) {
      this.mensajeError =
        'El nombre debe tener entre 1 y 24 caracteres.';
      return false;
    }

    this.nombreJugador = nombre;
    return true;
  }

  crearPartida(): void {
  this.limpiarMensajes();

  if (!this.validarNombre()) {
    return;
  }

  this.cargando = true;
  console.log('Enviando solicitud para crear partida...');

  this.partidaService.crearPartida(this.nombreJugador).subscribe({
    next: (respuesta) => {
      console.log('Respuesta al crear partida:', respuesta);

      this.mensajeExito =
        `Partida creada. Código: ${respuesta.partida_id}`;

      this.mensajeError = '';
      this.cargando = false;

      this.cdr.detectChanges();

      console.log('Cargando después del éxito:', this.cargando);
    },

    error: (error: HttpErrorResponse) => {
      console.error('Error al crear partida:', error);

      this.mensajeError = this.obtenerMensajeError(error);
      this.mensajeExito = '';
      this.cargando = false;

      this.cdr.detectChanges();
    }
  });
}

  unirsePartida(): void {
    this.limpiarMensajes();

    if (!this.validarNombre()) {
      return;
    }

    const codigo = this.codigoPartida.trim();

    if (!codigo) {
      this.mensajeError = 'Ingresá el código de la partida.';
      return;
    }

    this.cargando = true;

    this.partidaService
      .unirsePartida(codigo, this.nombreJugador)
      .subscribe({
        next: (respuesta: any) => {
          this.cargando = false;
          this.mensajeExito = 'Te uniste a la partida correctamente.';

          console.log('Respuesta al unirse:', respuesta);
        },
        error: (error: HttpErrorResponse) => {
          this.cargando = false;
          this.mensajeError = this.obtenerMensajeError(error);
        }
      });
  }

  private limpiarMensajes(): void {
    this.mensajeError = '';
    this.mensajeExito = '';
  }

  private obtenerMensajeError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revisá tu conexión.';
    }

    if (error.status === 400) {
      return 'Los datos enviados no son válidos. Revisá el nombre y el código.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'El servidor rechazó la solicitud.';
    }

    if (error.status === 404) {
      return 'No se encontró la partida indicada.';
    }

    if (error.status === 409) {
      return 'No se pudo completar la operación porque existe un conflicto con la partida.';
    }

    return error.error?.mensaje
      ?? error.error?.message
      ?? 'Ocurrió un error al procesar la solicitud.';
  }
}
