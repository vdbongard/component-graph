import { Injectable } from '@angular/core';
import { Settings } from '../interfaces';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private defaultSettings: Settings = {
    textCenter: true,
    text: true,
    fade: true,
    fullScreen: false
  };

  settings$ = new BehaviorSubject(this.defaultSettings);

  constructor() {}

  restoreSettings() {
    const settings: string = window.localStorage.getItem('settings');
    if (settings && settings.startsWith('{')) {
      this.settings$.next(JSON.parse(settings));
    }
  }

  setSettings(settings: Settings) {
    window.localStorage.setItem('settings', JSON.stringify(settings));
    this.settings$.next(settings);
  }
}
