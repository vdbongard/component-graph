import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FileWithPath } from '../../helper/getFilesAsync';
import { NodeSelection } from '../../interfaces';
import { DataService } from '../../services/data.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit, OnDestroy {
  selectedNodes: NodeSelection[];
  id: string;
  progress: number;
  gutterSize = 8;

  private selectedNodeSub: Subscription;
  private progressSub: Subscription;

  constructor(
    public dataService: DataService,
    public settingsService: SettingsService,
    private router: Router
  ) {}

  ngOnInit() {
    window.onbeforeunload = () => this.dataService.saveToLocalStorage();

    this.selectedNodeSub = this.dataService.selectedNodes$.subscribe(nodes => {
      this.selectedNodes = nodes;
    });

    this.progressSub = this.dataService.progress$.subscribe(progress => (this.progress = progress));
  }

  ngOnDestroy() {
    this.selectedNodeSub.unsubscribe();
    this.progressSub.unsubscribe();
  }

  onFileDropped(files: FileWithPath[]) {
    this.dataService.setFiles(files);
    this.router.navigate(['graph'], { queryParams: { upload: 1 } });
  }
}
