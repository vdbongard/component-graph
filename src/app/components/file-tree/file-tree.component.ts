import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FileTree, FlatNode, Node, NodeSelection } from '../../interfaces';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material';
import { FlatTreeControl } from '@angular/cdk/tree';
import { DataService } from '../../services/data.service';
import { Router } from '@angular/router';
import { extractFileTree } from '../../helper/extractFileTree';

@Component({
  selector: 'app-file-tree',
  templateUrl: './file-tree.component.html',
  styleUrls: ['./file-tree.component.scss']
})
export class FileTreeComponent implements OnInit, OnChanges {
  @Input() selectedNodes: NodeSelection[];

  treeControl = new FlatTreeControl<FlatNode>(
    node => node.level,
    node => node.expandable
  );

  treeFlattener = new MatTreeFlattener(
    transformer,
    node => node.level,
    node => node.expandable,
    node => node.children
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  timer: number;
  doubleClickDelay = 500;

  constructor(public dataService: DataService, public router: Router) {}

  ngOnInit(): void {
    this.dataService.fileMap$.subscribe(fileMap => {
      if (!fileMap) {
        return;
      }

      const fileTree = extractFileTree(fileMap);
      console.log('FileTree:', fileTree);
      this.dataSource.data = fileTree;

      this.treeControl.dataNodes
        .filter(node => node.level <= 1)
        .forEach(node => this.treeControl.expand(node));
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // expand closed tree nodes for selected file
    if (changes.selectedNodes && changes.selectedNodes.currentValue) {
      const selectedNodes: Node[] = changes.selectedNodes.currentValue;
      selectedNodes.forEach(selectedNode => {
        const fileName = selectedNode.id.split('#')[0];
        this.expandTreeByFileName(fileName);
      });
    }
  }

  expandTreeByFileName(fileName: string) {
    const parts = fileName.split('/');
    parts.shift(); // remove first empty string element (fileName always starts with '/')

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      const dataNode = this.treeControl.dataNodes.find(
        node => node.expandable && node.name === part && node.level === i
      );

      if (dataNode && !this.treeControl.isExpanded(dataNode)) {
        this.treeControl.expand(dataNode);
      }
    }
  }

  hasChild = (_: number, node: FlatNode) => node.expandable;

  routeToAppGraph() {
    this.router.navigate(['graph'], { queryParams: { id: null } });
  }

  routeToComponentGraph(fileName: string) {
    const componentName = this.dataService.getComponentName(fileName);

    if (!componentName) {
      return;
    }

    this.router.navigate(['graph'], {
      queryParams: { id: `${fileName}#${componentName}` },
      queryParamsHandling: 'merge'
    });
  }

  onFileClick(node: FileTree) {
    if (!this.isSelected(node)) {
      this.dataService.selectFile(node.id);
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;

      this.routeToAppGraph();
    }, this.doubleClickDelay);
  }

  onFileDoubleClick(node: FileTree) {
    clearTimeout(this.timer);
    this.timer = null;

    this.routeToComponentGraph(node.id);
  }

  isSelected(node: FileTree) {
    return this.selectedNodes && this.selectedNodes[0].id.split('#')[0] === node.id;
  }
}

const transformer = (node: FileTree, level: number) => {
  return {
    expandable: !!node.children && node.children.length > 0,
    name: node.name,
    type: node.type,
    id: node.id,
    level
  };
};
