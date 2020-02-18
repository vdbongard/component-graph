import { A11yModule } from '@angular/cdk/a11y';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  MatButtonModule,
  MatCardModule,
  MatDialogModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatProgressBarModule,
  MatRippleModule,
  MatSelectModule,
  MatSlideToggleModule,
  MatSnackBarModule,
  MatTooltipModule,
  MatTreeModule
} from '@angular/material';
import { MatToolbarModule } from '@angular/material/toolbar';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AngularSplitModule } from 'angular-split';
import { CodemirrorModule } from 'ng2-codemirror';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CodeQualityComponent } from './components/code-quality/code-quality.component';
import { FileTreeComponent } from './components/file-tree/file-tree.component';
import { GraphViewComponent } from './components/graph-view/graph-view.component';
import { GraphComponent } from './components/graph/graph.component';
import { QualityMetricComponent } from './components/quality-metric/quality-metric.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { SourceCodeComponent } from './components/source-code/source-code.component';
import { UploadViewComponent } from './components/upload-view/upload-view.component';
import { DropTargetDirective } from './directives/drop-target.directive';
import { NestedStringAccessorPipe } from './pipes/nested-string-accessor.pipe';

@NgModule({
  declarations: [
    AppComponent,
    GraphComponent,
    UploadViewComponent,
    DropTargetDirective,
    SettingsModalComponent,
    GraphViewComponent,
    CodeQualityComponent,
    SourceCodeComponent,
    FileTreeComponent,
    QualityMetricComponent,
    NestedStringAccessorPipe
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatInputModule,
    A11yModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    CodemirrorModule,
    FormsModule,
    AngularSplitModule.forRoot(),
    MatListModule,
    MatTreeModule,
    MatRippleModule,
    MatSnackBarModule,
    MatSelectModule
  ],
  entryComponents: [SettingsModalComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
