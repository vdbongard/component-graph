import { Component, OnDestroy, OnInit } from '@angular/core';
import { DataService } from '../../services/data.service';
import { Router } from '@angular/router';
import { NodeSelection, Settings } from '../../interfaces';
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
  settings: Settings;

  private graphDataSub: Subscription;
  private settingsSub: Subscription;
  private selectedNodeSub: Subscription;
  private progressSub: Subscription;

  constructor(
    public dataService: DataService,
    public settingsService: SettingsService,
    private router: Router
  ) {}

  ngOnInit() {
    this.settingsSub = this.settingsService.settings$.subscribe(settings => {
      this.settings = { ...this.settings, ...settings };
    });

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
    this.settingsSub.unsubscribe();
    this.selectedNodeSub.unsubscribe();
    this.progressSub.unsubscribe();
    if (this.graphDataSub) {
      this.graphDataSub.unsubscribe();
    }
  }

  onFileDropped(files: FileWithPath[]) {
    this.dataService.setFiles(files);
    this.router.navigate(['graph'], { queryParams: { upload: 1 } });
  }
}
