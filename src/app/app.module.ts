import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatToolbarModule } from '@angular/material/toolbar';
import { GraphComponent } from './components/graph/graph.component';
import { UploadViewComponent } from './components/upload-view/upload-view.component';
import {
  MatButtonModule,
  MatCardModule,
  MatDialogModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatProgressBarModule,
  MatRippleModule,
  MatSlideToggleModule,
  MatTooltipModule,
  MatTreeModule
} from '@angular/material';
import { DropTargetDirective } from './directives/drop-target.directive';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { GraphViewComponent } from './components/graph-view/graph-view.component';
import { CodeQualityComponent } from './components/code-quality/code-quality.component';
import { SourceCodeComponent } from './components/source-code/source-code.component';
import { FileTreeComponent } from './components/file-tree/file-tree.component';
import { CodemirrorModule } from 'ng2-codemirror';
import { AngularSplitModule } from 'angular-split';
import { QualityMetricComponent } from './components/quality-metric/quality-metric.component';

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
    QualityMetricComponent
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
    MatRippleModule
  ],
  entryComponents: [SettingsModalComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
