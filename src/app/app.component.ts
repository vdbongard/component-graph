import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { SettingsService } from './services/settings.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'component-graph';

  constructor(
    public dialog: MatDialog,
    private settingsService: SettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.settingsService.restoreSettings();

    if (window.location.pathname !== '/graph' && window.localStorage.getItem('graph')) {
      this.router.navigateByUrl('/graph');
    }
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(SettingsModalComponent, {
      width: '480px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.settingsService.setSettings(result);
      }
    });
  }
}
