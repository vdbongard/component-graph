import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Settings } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private defaultSettings: Settings = {
    text: true,
    fade: true,
    highlightIndirectNodes: true,
    fullScreen: false,
    colaLayout: true,
    nodeSizesBasedOnMetrics: true,
    autoZoom: true,
    currentSizeMetricErrorHighlighting: false,
    hideOverlappingLabels: true
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
