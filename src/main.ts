import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { MatCardModule } from '@angular/material/card';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
