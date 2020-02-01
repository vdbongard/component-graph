import { Component, OnDestroy, OnInit } from '@angular/core';
import { DataService } from '../../services/data.service';
import { Router } from '@angular/router';
import { NodeSelection } from '../../interfaces';
import { Subscription } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { FileWithPath } from '../../helper/getFilesAsync';

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
      if (!nodes) {
        return;
      }
      for (const node of nodes) {
        if (node.report && node.report.aggregate) {
          node.report.aggregate.halstead.operands.identifiers = ['...'];
          node.report.aggregate.halstead.operators.identifiers = ['...'];
        }
      }
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
