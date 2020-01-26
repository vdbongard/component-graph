import { Component, OnDestroy, OnInit } from '@angular/core';
import { DataService } from '../../services/data.service';
import { Router } from '@angular/router';
import { FileTree, NodeSelection } from '../../interfaces';
import { Subscription } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { FileWithPath } from '../../helper/getFilesAsync';

@Component({
  selector: 'app-graph-view',
  templateUrl: './graph-view.component.html',
  styleUrls: ['./graph-view.component.scss']
})
export class GraphViewComponent implements OnInit, OnDestroy {
  selectedNode: NodeSelection;
  id: string;
  progress: number;
  gutterSize = 8;

  private selectedNodeSub: Subscription;
  private progressSub: Subscription;
  fileTree: FileTree[] = [
    {
      type: 'folder',
      name: 'src',
      children: [
        {
          type: 'file',
          name: 'App.tsx'
        },
        {
          type: 'folder',
          name: 'components',
          children: [
            {
              type: 'file',
              name: 'ComponentA.tsx'
            },
            {
              type: 'file',
              name: 'ComponentB.tsx'
            },
            {
              type: 'file',
              name: 'ComponentC.tsx'
            }
          ]
        }
      ]
    }
  ];

  constructor(
    public dataService: DataService,
    public settingsService: SettingsService,
    private router: Router
  ) {}

  ngOnInit() {
    window.onbeforeunload = () => this.dataService.saveToLocalStorage();

    this.selectedNodeSub = this.dataService.selectedNode$.subscribe(node => {
      if (!node) {
        return;
      }
      if (node.report && node.report.aggregate) {
        node.report.aggregate.halstead.operands.identifiers = ['...'];
        node.report.aggregate.halstead.operators.identifiers = ['...'];
      }
      this.selectedNode = node;
    });

    this.progressSub = this.dataService.progress$.subscribe(
      progress => (this.progress = progress)
    );
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
