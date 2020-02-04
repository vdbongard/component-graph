import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GraphViewComponent } from './components/graph-view/graph-view.component';
import { UploadViewComponent } from './components/upload-view/upload-view.component';

const routes: Routes = [
  { path: '', component: UploadViewComponent },
  { path: 'graph', component: GraphViewComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
