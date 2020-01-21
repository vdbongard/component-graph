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
  MatProgressBarModule,
  MatSlideToggleModule,
  MatTooltipModule
} from '@angular/material';
import { DropTargetDirective } from './directives/drop-target.directive';
import { NgxResizableModule } from '@3dgenomes/ngx-resizable';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { ReactiveFormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { GraphViewComponent } from './components/graph-view/graph-view.component';
import { CodeQualityComponent } from './components/code-quality/code-quality.component';
import { SourceCodeComponent } from './components/source-code/source-code.component';
import { FileTreeComponent } from './components/file-tree/file-tree.component';

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
    FileTreeComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    NgxResizableModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule,
    MatInputModule,
    A11yModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
    MatProgressBarModule
  ],
  entryComponents: [SettingsModalComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
