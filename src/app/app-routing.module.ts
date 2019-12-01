import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { GraphComponent } from './components/graph/graph.component';
import { UploadViewComponent } from './components/upload-view/upload-view.component';

const routes: Routes = [
  { path: '', component: UploadViewComponent },
  { path: 'graph', component: GraphComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
