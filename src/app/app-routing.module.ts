import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UploadViewComponent } from './components/upload-view/upload-view.component';
import { GraphViewComponent } from './components/graph-view/graph-view.component';

const routes: Routes = [
  { path: '', component: UploadViewComponent },
  { path: 'graph', component: GraphViewComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
