import { Component, Input, OnInit } from '@angular/core';
import { FileTree, FlatNode } from '../../interfaces';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material';
import { FlatTreeControl } from '@angular/cdk/tree';

@Component({
  selector: 'app-file-tree',
  templateUrl: './file-tree.component.html',
  styleUrls: ['./file-tree.component.scss']
})
export class FileTreeComponent implements OnInit {
  @Input() fileTree: FileTree[];

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

  constructor() {}

  ngOnInit(): void {
    this.dataSource.data = this.fileTree;
  }

  hasChild = (_: number, node: FlatNode) => node.expandable;
}

const transformer = (node: FileTree, level: number) => {
  return {
    expandable: !!node.children && node.children.length > 0,
    name: node.name,
    type: node.type,
    level
  };
};
