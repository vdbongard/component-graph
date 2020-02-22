import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { Settings } from '../../interfaces';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-settings-modal',
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.scss']
})
export class SettingsModalComponent implements OnInit {
  settingsForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<SettingsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Settings,
    private formBuilder: FormBuilder,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.settingsForm = this.formBuilder.group(this.settingsService.fullSettings);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
