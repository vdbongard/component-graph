import { Component, Input, OnInit } from '@angular/core';
import { FileMap, FileTree, FlatNode, NodeSelection } from '../../interfaces';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material';
import { FlatTreeControl } from '@angular/cdk/tree';
import { DataService } from '../../services/data.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-file-tree',
  templateUrl: './file-tree.component.html',
  styleUrls: ['./file-tree.component.scss']
})
export class FileTreeComponent implements OnInit {
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
  doubleClickDelay = 100;
  preventClickEvent = false;

  constructor(public dataService: DataService, public router: Router) {}

  ngOnInit(): void {
    this.dataService.fileMap$.subscribe(fileMap => {
      if (!fileMap) {
        return;
      }

      const fileTree = this.extractFileTree(fileMap);
      console.log('FileTree:', fileTree);
      this.dataSource.data = fileTree;

      this.treeControl.dataNodes
        .filter(node => node.level <= 1)
        .forEach(node => this.treeControl.expand(node));
    });
  }

  hasChild = (_: number, node: FlatNode) => node.expandable;

  private extractFileTree(fileMap: FileMap): FileTree[] {
    if (!fileMap) {
      return [];
    }

    const fileNames = Object.keys(fileMap);
    const fileTrees: FileTree[] = [];

    for (const fileName of fileNames) {
      const parts = fileName.split('/');
      parts.shift(); // remove first empty string element (fileName always starts with '/')

      const leaf: FileTree = {
        name: parts.pop(),
        id: fileName,
        type: 'file'
      };

      let index = 0;
      let innerTree: FileTree = fileTrees.find(node => node.name === parts[0]);
      let folderIsMissing = !innerTree;

      if (innerTree) {
        // search the tree for nested folders
        for (let i = 1; i < parts.length; i++) {
          if (!innerTree.children) {
            folderIsMissing = true;
            break;
          }
          index = i;
          const folderName = parts[i];
          const newInnerTree = innerTree.children.find(
            node => node.name === folderName && node.type === 'folder'
          );
          if (!newInnerTree) {
            folderIsMissing = true;
            break;
          }
          innerTree = newInnerTree;
        }
      }

      // a folder was not found so we need to create all missing ones
      if (folderIsMissing) {
        if (!innerTree) {
          innerTree = {
            name: parts[index],
            type: 'folder'
          };
          fileTrees.push(innerTree);
          index++;
        }

        while (index < parts.length) {
          const folder: FileTree = {
            name: parts[index],
            type: 'folder'
          };

          if (!innerTree.children) {
            innerTree.children = [folder];
          } else {
            innerTree.children.push(folder);
          }

          innerTree = folder;
          index++;
        }
      }

      if (!innerTree.children) {
        innerTree.children = [leaf];
      } else {
        innerTree.children.push(leaf);
      }
    }

    return this.sortFileTrees(fileTrees);
  }

  private sortFileTrees(fileTrees: FileTree[]) {
    fileTrees.forEach(fileTree => {
      if (fileTree.children) {
        this.sortFileTrees(fileTree.children);
      }
    });
    return fileTrees.sort(this.sortFilesAndFolders);
  }

  private sortFilesAndFolders = (a: FileTree, b: FileTree) => {
    if (a.type === 'folder' && b.type !== 'folder') {
      return -1;
    }

    if (a.type !== 'folder' && b.type === 'folder') {
      return 1;
    }

    if (a.name.toLowerCase() > b.name.toLowerCase()) {
      return 1;
    }
    if (a.name.toLowerCase() < b.name.toLowerCase()) {
      return -1;
    }

    return 0;
  };

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
    this.preventClickEvent = false;
    this.timer = setTimeout(() => {
      if (!this.preventClickEvent) {
        this.routeToAppGraph();
        this.dataService.selectFile(node);
      }
    }, this.doubleClickDelay);
  }

  onFileDoubleClick(node: FileTree) {
    clearTimeout(this.timer);
    this.preventClickEvent = true;

    this.dataService.selectFile(node);
    this.routeToComponentGraph(node.id);
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
