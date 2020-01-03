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
  fullSettings: Settings = this.defaultSettings;
  settings$ = new BehaviorSubject(this.defaultSettings);

  constructor() {}

  restoreSettings() {
    const rawSettings: string = window.localStorage.getItem('settings');
    if (rawSettings && rawSettings.startsWith('{')) {
      const settings = { ...this.defaultSettings, ...JSON.parse(rawSettings) };
      this.settings$.next(settings);
      this.fullSettings = settings;
    }
  }

  setSettings(settings: Settings) {
    this.fullSettings = { ...this.fullSettings, ...settings };
    window.localStorage.setItem('settings', JSON.stringify(this.fullSettings));
    this.settings$.next(settings);
  }
}
